import { describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { AuthConfig } from '../auth/config.js';
import { signJwt } from '../auth/jwt.js';
import type { ComposerPublishResult, ContentComposerService } from '../composer/types.js';
import type { PublishingQueueEnqueuer } from '../queue/publishing-enqueue.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.41.0-test',
  databaseUrl: 'postgres://test',
  storageLocalRoot: '/tmp/storage',
  defaultOrgId: 'org-1',
  defaultProjectId: 'proj-abc',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: 'redis://127.0.0.1:6379',
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
  jwtSecret: 'publish-workflow-secret-at-least-32-chars',
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['smoke-key'],
  apiKeyRoles: {},
  defaultJwtRole: 'operator',
  defaultApiKeyRole: 'admin',
};

const publishResult: ComposerPublishResult = {
  assetId: 'asset-001',
  accepted: [{ publisherId: 'wordpress', jobId: 'job-1' }],
  skipped: [{ publisherId: 'ghost', reason: 'Duplicate slug' }],
  failures: [{ publisherId: 'unknown', reason: 'Publisher not registered' }],
};

function makeMockComposer(overrides: Partial<ContentComposerService> = {}): ContentComposerService {
  return {
    listEligibleAssets: vi.fn(),
    getComposerAsset: vi.fn(),
    validate: vi.fn(),
    publish: vi.fn().mockResolvedValue(publishResult),
    bulkPublish: vi.fn(),
    schedule: vi.fn(),
    ...overrides,
  };
}

function makeMockEnqueuer(): PublishingQueueEnqueuer {
  return {
    enqueue: vi.fn().mockResolvedValue('job-1'),
    close: vi.fn(),
  };
}

describe('POST /composer/publish', () => {
  it('enqueues jobs and returns 202 with summary', async () => {
    const composer = makeMockComposer();
    const app = buildApp({
      config: baseConfig,
      composerService: composer,
      publishingEnqueuer: makeMockEnqueuer(),
      authConfig,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/publish',
      headers: { 'x-api-key': 'smoke-key' },
      payload: { assetId: 'asset-001', publisherIds: ['wordpress', 'ghost'] },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json() as ComposerPublishResult;
    expect(body.accepted).toHaveLength(1);
    expect(body.skipped).toHaveLength(1);
    expect(composer.publish).toHaveBeenCalledWith({
      projectId: 'proj-abc',
      assetId: 'asset-001',
      publisherIds: ['wordpress', 'ghost'],
    });
    await app.close();
  });

  it('returns 401 without auth when enabled', async () => {
    const app = buildApp({
      config: baseConfig,
      composerService: makeMockComposer(),
      publishingEnqueuer: makeMockEnqueuer(),
      authConfig,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/publish',
      payload: { assetId: 'asset-001', publisherIds: ['wordpress'] },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 503 when queue unavailable', async () => {
    const app = buildApp({
      config: baseConfig,
      composerService: makeMockComposer(),
      authConfig,
    });
    const token = signJwt({ sub: 'test', role: 'publisher' }, authConfig.jwtSecret, 3600);
    const res = await app.inject({
      method: 'POST',
      url: '/composer/publish',
      headers: { authorization: `Bearer ${token}` },
      payload: { assetId: 'asset-001', publisherIds: ['wordpress'] },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it('returns 400 when publisherIds empty', async () => {
    const app = buildApp({
      config: baseConfig,
      composerService: makeMockComposer(),
      publishingEnqueuer: makeMockEnqueuer(),
      authConfig,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/publish',
      headers: { 'x-api-key': 'smoke-key' },
      payload: { assetId: 'asset-001', publisherIds: [] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
