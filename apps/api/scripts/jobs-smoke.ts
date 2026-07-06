/**
 * Publishing jobs API smoke — Sprint 38.
 *
 * Offline — uses mocked QueueService via fastify.inject().
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { AuthConfig } from '../src/auth/config.js';
import { signJwt } from '../src/auth/jwt.js';
import type { JobDetail, JobListItem } from '../src/queue/job-types.js';
import type { QueueService } from '../src/queue/queue-service.js';
import { QueueJobNotFoundError } from '../src/queue/queue-service.js';

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
function section(title: string): void {
  console.log(`\n[${title}]`);
}

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.38.0-smoke',
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

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: 'jobs-smoke-secret-at-least-32-chars',
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['smoke-key'],
};

const listItem: JobListItem = {
  id: 'job-smoke-1',
  name: 'publish',
  status: 'failed',
  publisher: 'mock',
  projectId: 'proj-1',
  assetId: 'asset-1',
  title: 'Smoke Post',
  slug: 'smoke-post',
  retryCount: 1,
  maxAttempts: 4,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:01:00.000Z',
};

const detail: JobDetail = {
  ...listItem,
  payload: {
    title: 'Smoke Post',
    slug: 'smoke-post',
    projectId: 'proj-1',
    assetId: 'asset-1',
    hasMedia: true,
  },
  queueState: 'failed',
  retryHistory: [{ attempt: 1, error: 'network error' }],
  queuePaused: false,
  error: { message: 'network error' },
};

function makeMockService(): QueueService {
  return {
    getStatus: async () => ({
      paused: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 1,
    }),
    pause: async () => undefined,
    resume: async () => undefined,
    drain: async () => undefined,
    retryJob: async () => undefined,
    removeJob: async () => undefined,
    listJobs: async () => ({ jobs: [listItem], total: 1, limit: 50, offset: 0 }),
    getJob: async (id) => {
      if (id !== 'job-smoke-1') throw new QueueJobNotFoundError(id);
      return detail;
    },
  };
}

async function main(): Promise<void> {
  const token = signJwt({ sub: 'smoke' }, authConfig.jwtSecret, 3600);
  const app = buildApp({
    config: baseConfig,
    authConfig,
    queueService: makeMockService(),
  });
  await app.ready();

  section('1 · List jobs');
  {
    const res = await app.inject({
      method: 'GET',
      url: '/jobs',
      headers: { 'x-api-key': 'smoke-key' },
    });
    assert(res.statusCode === 200, 'GET /jobs returns 200');
    const body = res.json() as { jobs: JobListItem[]; total: number };
    assert(body.total === 1, 'one job returned');
    assert(body.jobs[0]?.id === 'job-smoke-1', 'job id present');
  }

  section('2 · Pagination params');
  {
    const res = await app.inject({
      method: 'GET',
      url: '/jobs?status=failed&limit=10&offset=0',
      headers: { authorization: `Bearer ${token}` },
    });
    assert(res.statusCode === 200, 'filtered list returns 200');
  }

  section('3 · Job detail');
  {
    const res = await app.inject({
      method: 'GET',
      url: '/jobs/job-smoke-1',
      headers: { 'x-api-key': 'smoke-key' },
    });
    assert(res.statusCode === 200, 'GET /jobs/:id returns 200');
    const body = res.json() as JobDetail;
    assert(body.retryHistory.length === 1, 'retry history included');
    assert(body.error?.message === 'network error', 'error included');
  }

  section('4 · Missing job');
  {
    const res = await app.inject({
      method: 'GET',
      url: '/jobs/missing',
      headers: { 'x-api-key': 'smoke-key' },
    });
    assert(res.statusCode === 404, 'missing job returns 404');
  }

  await app.close();
  console.log('\n✅  All publishing jobs API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
