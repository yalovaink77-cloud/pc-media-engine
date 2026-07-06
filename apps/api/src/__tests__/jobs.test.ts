import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { AuthConfig } from '../auth/config.js';
import { signJwt } from '../auth/jwt.js';
import type { JobDetail, JobListItem } from '../queue/job-types.js';
import type { QueueService } from '../queue/queue-service.js';
import { QueueJobNotFoundError } from '../queue/queue-service.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.38.0-test',
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

const JWT_SECRET = 'jobs-test-secret-at-least-32-chars!!';

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: JWT_SECRET,
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['jobs-test-api-key'],
  apiKeyRoles: {},
  defaultJwtRole: 'operator',
  defaultApiKeyRole: 'admin',
};

function makeToken(): string {
  return signJwt({ sub: 'operator-1' }, JWT_SECRET, 3600);
}

const jobFixture: JobListItem = {
  id: 'job-001',
  name: 'publish',
  status: 'failed',
  publisher: 'mock',
  projectId: 'proj-abc',
  assetId: 'asset-xyz',
  title: 'Test Article',
  slug: 'test-article',
  retryCount: 3,
  maxAttempts: 4,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:05:00.000Z',
};

const detailFixture: JobDetail = {
  ...jobFixture,
  payload: {
    title: 'Test Article',
    slug: 'test-article',
    projectId: 'proj-abc',
    assetId: 'asset-xyz',
    hasMedia: true,
    mediaMimeType: 'image/jpeg',
  },
  queueState: 'failed',
  error: { message: 'Publisher unreachable', stacktrace: ['Error: timeout'] },
  retryHistory: [
    { attempt: 1, error: 'Connection refused' },
    { attempt: 2, error: 'Timeout' },
    { attempt: 3, error: 'Publisher unreachable' },
  ],
  queuePaused: false,
};

function makeMockQueueService(overrides: Partial<QueueService> = {}): QueueService {
  return {
    getStatus: vi.fn().mockResolvedValue({
      paused: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 1,
    }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    drain: vi.fn().mockResolvedValue(undefined),
    retryJob: vi.fn().mockResolvedValue(undefined),
    removeJob: vi.fn().mockResolvedValue(undefined),
    listJobs: vi.fn().mockResolvedValue({
      jobs: [jobFixture],
      total: 1,
      limit: 50,
      offset: 0,
    }),
    getJob: vi.fn().mockResolvedValue(detailFixture),
    ...overrides,
  };
}

let app: ReturnType<typeof buildApp> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /jobs', () => {
  it('returns 401 without auth', async () => {
    app = buildApp({ config: baseConfig, authConfig, queueService: makeMockQueueService() });
    const res = await app.inject({ method: 'GET', url: '/jobs' });
    expect(res.statusCode).toBe(401);
  });

  it('returns paginated jobs with auth', async () => {
    const qs = makeMockQueueService();
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    const res = await app.inject({
      method: 'GET',
      url: '/jobs',
      headers: { 'x-api-key': 'jobs-test-api-key' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      jobs: JobListItem[];
      total: number;
      limit: number;
      offset: number;
    };
    expect(body.total).toBe(1);
    expect(body.jobs[0]?.id).toBe('job-001');
    expect(body.jobs[0]?.publisher).toBe('mock');
    expect(qs.listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 }),
      'mock',
    );
  });

  it('passes query filters to listJobs', async () => {
    const qs = makeMockQueueService();
    app = buildApp({ config: baseConfig, authConfig, queueService: qs });
    await app.inject({
      method: 'GET',
      url: '/jobs?status=failed&projectId=proj-abc&assetId=asset-xyz&limit=10&offset=5',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(qs.listJobs).toHaveBeenCalledWith(
      {
        status: 'failed',
        publisher: undefined,
        projectId: 'proj-abc',
        assetId: 'asset-xyz',
        limit: 10,
        offset: 5,
      },
      'mock',
    );
  });

  it('returns 400 for invalid status', async () => {
    app = buildApp({ config: baseConfig, authConfig, queueService: makeMockQueueService() });
    const res = await app.inject({
      method: 'GET',
      url: '/jobs?status=invalid',
      headers: { 'x-api-key': 'jobs-test-api-key' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 503 when queue service absent', async () => {
    app = buildApp({ config: baseConfig, authConfig });
    const res = await app.inject({
      method: 'GET',
      url: '/jobs',
      headers: { 'x-api-key': 'jobs-test-api-key' },
    });
    expect(res.statusCode).toBe(503);
  });
});

describe('GET /jobs/:id', () => {
  it('returns job detail with retry history', async () => {
    app = buildApp({ config: baseConfig, authConfig, queueService: makeMockQueueService() });
    const res = await app.inject({
      method: 'GET',
      url: '/jobs/job-001',
      headers: { 'x-api-key': 'jobs-test-api-key' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as JobDetail;
    expect(body.id).toBe('job-001');
    expect(body.payload.hasMedia).toBe(true);
    expect(body.retryHistory).toHaveLength(3);
    expect(body.error?.message).toContain('unreachable');
    expect(body.queueState).toBe('failed');
  });

  it('returns 404 for missing job', async () => {
    app = buildApp({
      config: baseConfig,
      authConfig,
      queueService: makeMockQueueService({
        getJob: vi.fn().mockRejectedValue(new QueueJobNotFoundError('missing')),
      }),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/jobs/missing',
      headers: { 'x-api-key': 'jobs-test-api-key' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('job pagination', () => {
  it('respects limit and offset in listJobs result', async () => {
    const jobs = Array.from({ length: 3 }, (_, i) => ({
      ...jobFixture,
      id: `job-${i}`,
      createdAt: new Date(2024, 5, 1, 10, i).toISOString(),
    }));
    app = buildApp({
      config: baseConfig,
      authConfig,
      queueService: makeMockQueueService({
        listJobs: vi.fn().mockResolvedValue({
          jobs: jobs.slice(1, 3),
          total: 3,
          limit: 2,
          offset: 1,
        }),
      }),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/jobs?limit=2&offset=1',
      headers: { 'x-api-key': 'jobs-test-api-key' },
    });
    const body = res.json() as {
      jobs: JobListItem[];
      total: number;
      limit: number;
      offset: number;
    };
    expect(body.total).toBe(3);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(1);
    expect(body.jobs).toHaveLength(2);
  });
});
