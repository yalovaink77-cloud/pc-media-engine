import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { AuthConfig } from '../auth/config.js';
import { signJwt } from '../auth/jwt.js';
import type { QueueService, QueueStatus } from '../queue/queue-service.js';
import { QueueJobNotFoundError, QueueJobStateError } from '../queue/queue-service.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.32.0-test',
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

const JWT_SECRET = 'queue-test-secret-at-least-32-chars!';

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: JWT_SECRET,
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['queue-test-api-key'],
};

function makeToken(): string {
  return signJwt({ sub: 'operator-1' }, JWT_SECRET, 3600);
}

function defaultStatus(): QueueStatus {
  return { paused: false, waiting: 2, active: 1, delayed: 0, completed: 10, failed: 3 };
}

function makeMockQueueService(overrides: Partial<QueueService> = {}): QueueService {
  return {
    getStatus: vi.fn().mockResolvedValue(defaultStatus()),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    drain: vi.fn().mockResolvedValue(undefined),
    retryJob: vi.fn().mockResolvedValue(undefined),
    removeJob: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let app: ReturnType<typeof buildApp> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

// ---------------------------------------------------------------------------
// GET /queue/status
// ---------------------------------------------------------------------------

describe('GET /queue/status', () => {
  it('returns 401 when no auth provided and auth is enabled', async () => {
    app = buildApp({ config: baseConfig, authConfig, queueService: makeMockQueueService() });
    const res = await app.inject({ method: 'GET', url: '/queue/status' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with status when valid Bearer JWT provided', async () => {
    const qs = makeMockQueueService();
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'GET',
      url: '/queue/status',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<QueueStatus>();
    expect(body.paused).toBe(false);
    expect(body.waiting).toBe(2);
    expect(body.active).toBe(1);
    expect(body.delayed).toBe(0);
    expect(body.completed).toBe(10);
    expect(body.failed).toBe(3);
  });

  it('returns 200 with valid X-API-Key header', async () => {
    app = buildApp({ config: baseConfig, authConfig, queueService: makeMockQueueService() });
    const res = await app.inject({
      method: 'GET',
      url: '/queue/status',
      headers: { 'x-api-key': 'queue-test-api-key' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 503 when no queueService injected', async () => {
    app = buildApp({ config: baseConfig, authConfig });
    const res = await app.inject({
      method: 'GET',
      url: '/queue/status',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(503);
  });

  it('reflects paused state', async () => {
    const qs = makeMockQueueService({
      getStatus: vi.fn().mockResolvedValue({ ...defaultStatus(), paused: true }),
    });
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'GET',
      url: '/queue/status',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.json<QueueStatus>().paused).toBe(true);
  });

  it('passes through when auth is disabled (no credentials required)', async () => {
    app = buildApp({ config: baseConfig, queueService: makeMockQueueService() });
    const res = await app.inject({ method: 'GET', url: '/queue/status' });
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /queue/pause
// ---------------------------------------------------------------------------

describe('POST /queue/pause', () => {
  it('returns 401 without auth', async () => {
    app = buildApp({ config: baseConfig, authConfig, queueService: makeMockQueueService() });
    expect((await app.inject({ method: 'POST', url: '/queue/pause' })).statusCode).toBe(401);
  });

  it('calls pause() and returns success', async () => {
    const qs = makeMockQueueService();
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ success: boolean }>().success).toBe(true);
    expect(qs.pause).toHaveBeenCalledOnce();
  });

  it('returns 503 when no queueService', async () => {
    app = buildApp({ config: baseConfig, authConfig });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// POST /queue/resume
// ---------------------------------------------------------------------------

describe('POST /queue/resume', () => {
  it('calls resume() and returns success', async () => {
    const qs = makeMockQueueService();
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/resume',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(qs.resume).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// POST /queue/drain
// ---------------------------------------------------------------------------

describe('POST /queue/drain', () => {
  it('calls drain() and returns success', async () => {
    const qs = makeMockQueueService();
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/drain',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(qs.drain).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// POST /queue/jobs/:id/retry
// ---------------------------------------------------------------------------

describe('POST /queue/jobs/:id/retry', () => {
  it('calls retryJob(id) and returns success', async () => {
    const qs = makeMockQueueService();
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/jobs/job-abc/retry',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(qs.retryJob).toHaveBeenCalledWith('job-abc');
  });

  it('returns 404 when QueueJobNotFoundError thrown', async () => {
    const qs = makeMockQueueService({
      retryJob: vi.fn().mockRejectedValue(new QueueJobNotFoundError('missing-id')),
    });
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/jobs/missing-id/retry',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when QueueJobStateError thrown', async () => {
    const qs = makeMockQueueService({
      retryJob: vi
        .fn()
        .mockRejectedValue(
          new QueueJobStateError('job-123', 'expected state "failed" but got "active"'),
        ),
    });
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/jobs/job-123/retry',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// DELETE /queue/jobs/:id
// ---------------------------------------------------------------------------

describe('DELETE /queue/jobs/:id', () => {
  it('calls removeJob(id) and returns success', async () => {
    const qs = makeMockQueueService();
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'DELETE',
      url: '/queue/jobs/job-xyz',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(qs.removeJob).toHaveBeenCalledWith('job-xyz');
  });

  it('returns 404 when QueueJobNotFoundError thrown', async () => {
    const qs = makeMockQueueService({
      removeJob: vi.fn().mockRejectedValue(new QueueJobNotFoundError('no-such-job')),
    });
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'DELETE',
      url: '/queue/jobs/no-such-job',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without credentials', async () => {
    app = buildApp({ config: baseConfig, authConfig, queueService: makeMockQueueService() });
    expect((await app.inject({ method: 'DELETE', url: '/queue/jobs/j1' })).statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// QueueService error types
// ---------------------------------------------------------------------------

describe('QueueJobNotFoundError', () => {
  it('has correct name and message', () => {
    const e = new QueueJobNotFoundError('j99');
    expect(e.name).toBe('QueueJobNotFoundError');
    expect(e.message).toContain('j99');
    expect(e.jobId).toBe('j99');
  });
});

describe('QueueJobStateError', () => {
  it('has correct name and message', () => {
    const e = new QueueJobStateError('j1', 'not failed');
    expect(e.name).toBe('QueueJobStateError');
    expect(e.message).toContain('j1');
    expect(e.message).toContain('not failed');
    expect(e.jobId).toBe('j1');
  });
});
