/**
 * Offline smoke test for Sprint 32 — Queue Operations.
 *
 * Exercises:
 *  - GET /queue/status (auth required, 503 when no service)
 *  - POST /queue/pause / resume / drain
 *  - POST /queue/jobs/:id/retry (success, 404, 409)
 *  - DELETE /queue/jobs/:id (success, 404)
 *  - Auth enforcement (401 without credentials)
 *  - All routes pass through when auth is disabled
 *
 * Uses an in-memory mock QueueService — no Redis, no Docker required.
 *
 * Run with:  pnpm queue:smoke
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { AuthConfig } from '../src/auth/config.js';
import { signJwt } from '../src/auth/jwt.js';
import type { QueueService, QueueStatus } from '../src/queue/queue-service.js';
import { QueueJobNotFoundError, QueueJobStateError } from '../src/queue/queue-service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}
function fail(label: string, detail?: unknown): never {
  console.error(`  ✗ ${label}`, detail ?? '');
  process.exit(1);
}
function assert(cond: boolean, label: string, detail?: unknown): void {
  if (!cond) fail(label, detail);
  pass(label);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CONFIG: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.32.0-smoke',
  databaseUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: '',
  defaultProjectId: '',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const JWT_SECRET = 'smoke-queue-secret-32-chars-minimum!!';

const AUTH_CONFIG: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: JWT_SECRET,
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['smoke-api-key'],
  apiKeyRoles: {},
  defaultJwtRole: 'operator',
  defaultApiKeyRole: 'admin',
};

function makeToken(): string {
  return signJwt({ sub: 'smoke-operator' }, JWT_SECRET, 3600);
}

// ---------------------------------------------------------------------------
// In-memory mock QueueService
// ---------------------------------------------------------------------------

type MockState = {
  paused: boolean;
  jobs: Map<string, { state: 'waiting' | 'active' | 'failed' | 'completed' }>;
};

function createMockQueueService(initial: Partial<MockState> = {}): QueueService {
  const state: MockState = {
    paused: initial.paused ?? false,
    jobs:
      initial.jobs ??
      new Map([
        ['job-1', { state: 'failed' }],
        ['job-2', { state: 'active' }],
        ['job-3', { state: 'waiting' }],
      ]),
  };

  function counts(): Omit<QueueStatus, 'paused'> {
    let waiting = 0,
      active = 0,
      failed = 0,
      completed = 0;
    for (const j of state.jobs.values()) {
      if (j.state === 'waiting') waiting++;
      else if (j.state === 'active') active++;
      else if (j.state === 'failed') failed++;
      else if (j.state === 'completed') completed++;
    }
    return { waiting, active, delayed: 0, completed, failed };
  }

  return {
    async getStatus(): Promise<QueueStatus> {
      return { paused: state.paused, ...counts() };
    },
    async pause(): Promise<void> {
      state.paused = true;
    },
    async resume(): Promise<void> {
      state.paused = false;
    },
    async drain(): Promise<void> {
      for (const [id, j] of state.jobs) {
        if (j.state === 'waiting') state.jobs.delete(id);
      }
    },
    async retryJob(jobId: string): Promise<void> {
      const job = state.jobs.get(jobId);
      if (!job) throw new QueueJobNotFoundError(jobId);
      if (job.state !== 'failed') throw new QueueJobStateError(jobId, `state is ${job.state}`);
      job.state = 'waiting';
    },
    async removeJob(jobId: string): Promise<void> {
      if (!state.jobs.has(jobId)) throw new QueueJobNotFoundError(jobId);
      state.jobs.delete(jobId);
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  console.log('\n[1] GET /queue/status — no service → 503');
  {
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG });
    try {
      const res = await a.inject({
        method: 'GET',
        url: '/queue/status',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      assert(res.statusCode === 503, `503 when no service (got ${res.statusCode})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[2] GET /queue/status — auth required (401 without credentials)');
  {
    const a = buildApp({
      config: BASE_CONFIG,
      authConfig: AUTH_CONFIG,
      queueService: createMockQueueService(),
    });
    try {
      const res = await a.inject({ method: 'GET', url: '/queue/status' });
      assert(res.statusCode === 401, `401 without creds (got ${res.statusCode})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[3] GET /queue/status — returns correct counts with Bearer JWT');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      const res = await a.inject({
        method: 'GET',
        url: '/queue/status',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      assert(res.statusCode === 200, `200 with JWT (got ${res.statusCode})`);
      const body = res.json<QueueStatus>();
      assert(body.paused === false, `paused=false`);
      assert(body.waiting === 1, `waiting=1 (got ${body.waiting})`);
      assert(body.active === 1, `active=1 (got ${body.active})`);
      assert(body.failed === 1, `failed=1 (got ${body.failed})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[4] GET /queue/status — works with X-API-Key header');
  {
    const a = buildApp({
      config: BASE_CONFIG,
      authConfig: AUTH_CONFIG,
      queueService: createMockQueueService(),
    });
    try {
      const res = await a.inject({
        method: 'GET',
        url: '/queue/status',
        headers: { 'x-api-key': 'smoke-api-key' },
      });
      assert(res.statusCode === 200, `200 with API key (got ${res.statusCode})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[5] POST /queue/pause → queue becomes paused');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      const res = await a.inject({
        method: 'POST',
        url: '/queue/pause',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      assert(res.statusCode === 200, `200 (got ${res.statusCode})`);
      assert(res.json<{ success: boolean }>().success === true, 'success=true');
      const status = await qs.getStatus();
      assert(status.paused === true, 'queue is paused after pause command');
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[6] POST /queue/resume → queue becomes running');
  {
    const qs = createMockQueueService({ paused: true });
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      await a.inject({
        method: 'POST',
        url: '/queue/resume',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      const status = await qs.getStatus();
      assert(status.paused === false, 'queue is running after resume');
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[7] POST /queue/drain → waiting jobs removed');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      await a.inject({
        method: 'POST',
        url: '/queue/drain',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      const status = await qs.getStatus();
      assert(status.waiting === 0, `waiting=0 after drain (got ${status.waiting})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[8] POST /queue/jobs/:id/retry — success for failed job');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      const res = await a.inject({
        method: 'POST',
        url: '/queue/jobs/job-1/retry',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      assert(res.statusCode === 200, `200 (got ${res.statusCode})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[9] POST /queue/jobs/:id/retry — 404 for unknown job');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      const res = await a.inject({
        method: 'POST',
        url: '/queue/jobs/no-such-job/retry',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      assert(res.statusCode === 404, `404 for unknown job (got ${res.statusCode})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[10] POST /queue/jobs/:id/retry — 409 for non-failed job');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      const res = await a.inject({
        method: 'POST',
        url: '/queue/jobs/job-2/retry', // job-2 is active
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      assert(res.statusCode === 409, `409 for non-failed job (got ${res.statusCode})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[11] DELETE /queue/jobs/:id — removes existing job');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      const res = await a.inject({
        method: 'DELETE',
        url: '/queue/jobs/job-3',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      assert(res.statusCode === 200, `200 (got ${res.statusCode})`);
      const status = await qs.getStatus();
      assert(status.waiting === 0, 'waiting job removed');
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[12] DELETE /queue/jobs/:id — 404 for unknown job');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, authConfig: AUTH_CONFIG, queueService: qs });
    try {
      const res = await a.inject({
        method: 'DELETE',
        url: '/queue/jobs/phantom-job',
        headers: { authorization: `Bearer ${makeToken()}` },
      });
      assert(res.statusCode === 404, `404 for unknown job (got ${res.statusCode})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[13] Auth disabled — all queue routes accessible without credentials');
  {
    const qs = createMockQueueService();
    const a = buildApp({ config: BASE_CONFIG, queueService: qs }); // no authConfig
    try {
      const statusRes = await a.inject({ method: 'GET', url: '/queue/status' });
      assert(
        statusRes.statusCode === 200,
        `GET /queue/status open when auth disabled (got ${statusRes.statusCode})`,
      );
      const pauseRes = await a.inject({ method: 'POST', url: '/queue/pause' });
      assert(
        pauseRes.statusCode === 200,
        `POST /queue/pause open when auth disabled (got ${pauseRes.statusCode})`,
      );
    } finally {
      await a.close();
    }
  }

  console.log('\n✅  All queue smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Queue smoke failed:', err);
  process.exit(1);
});
