import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { AuthConfig } from '../auth/config.js';
import { signJwt } from '../auth/jwt.js';
import type { QueueService } from '../queue/queue-service.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.45.0-test',
  databaseUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: '',
  defaultProjectId: 'proj-abc',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const JWT_SECRET = 'rbac-test-secret-at-least-32-chars!';

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: JWT_SECRET,
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['rbac-test-key'],
  apiKeyRoles: { 'rbac-test-key': 'viewer' },
  defaultJwtRole: 'operator',
  defaultApiKeyRole: 'admin',
};

function token(role: string): string {
  return signJwt({ sub: 'user-1', role }, JWT_SECRET, 3600);
}

function makeQueueService(): QueueService {
  return {
    getStatus: vi.fn().mockResolvedValue({
      paused: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    drain: vi.fn(),
    retryJob: vi.fn(),
    removeJob: vi.fn(),
    listJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0, limit: 50, offset: 0 }),
    getJob: vi.fn(),
  };
}

describe('RBAC middleware', () => {
  it('returns 403 when viewer attempts queue write', async () => {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      queueService: makeQueueService(),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${token('viewer')}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as { permission: string; role: string };
    expect(body.permission).toBe('queue:write');
    expect(body.role).toBe('viewer');
    await app.close();
  });

  it('allows operator queue write', async () => {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      queueService: makeQueueService(),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${token('operator')}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('allows publisher composer publish', async () => {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      composerService: {
        listEligibleAssets: vi.fn(),
        getComposerAsset: vi.fn(),
        validate: vi.fn(),
        publish: vi
          .fn()
          .mockResolvedValue({ assetId: 'a', accepted: [], skipped: [], failures: [] }),
        bulkPublish: vi.fn(),
        schedule: vi.fn(),
      },
      publishingEnqueuer: { enqueue: vi.fn().mockResolvedValue('job-1'), close: vi.fn() },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/publish',
      headers: { authorization: `Bearer ${token('publisher')}` },
      payload: { assetId: 'asset-1', publisherIds: ['wordpress'] },
    });
    expect(res.statusCode).toBe(202);
    await app.close();
  });

  it('denies viewer composer publish with 403', async () => {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      composerService: {
        listEligibleAssets: vi.fn(),
        getComposerAsset: vi.fn(),
        validate: vi.fn(),
        publish: vi.fn(),
        bulkPublish: vi.fn(),
        schedule: vi.fn(),
      },
      publishingEnqueuer: { enqueue: vi.fn(), close: vi.fn() },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/publish',
      headers: { authorization: `Bearer ${token('viewer')}` },
      payload: { assetId: 'asset-1', publisherIds: ['wordpress'] },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('skips RBAC when auth disabled', async () => {
    const app = buildApp({
      config: baseConfig,
      authConfig: { ...authConfig, enabled: false },
      queueService: makeQueueService(),
    });
    const res = await app.inject({ method: 'POST', url: '/queue/pause' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('GET /auth/rbac returns role metadata', async () => {
    const app = buildApp({ config: baseConfig, authConfig });
    const res = await app.inject({ method: 'GET', url: '/auth/rbac' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { roles: unknown[]; permissions: unknown[] };
    expect(body.roles.length).toBe(4);
    expect(body.permissions.length).toBeGreaterThan(0);
    await app.close();
  });
});
