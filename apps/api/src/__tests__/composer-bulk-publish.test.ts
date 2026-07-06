import { describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { AuthConfig } from '../auth/config.js';
import type { ComposerBulkPublishResult, ContentComposerService } from '../composer/types.js';
import type { PublishingQueueEnqueuer } from '../queue/publishing-enqueue.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.42.0-test',
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
  jwtSecret: 'bulk-publish-secret-at-least-32-chars',
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['smoke-key'],
};

const bulkResult: ComposerBulkPublishResult = {
  accepted: [
    { assetId: 'asset-1', publisherId: 'wordpress', jobId: 'job-1' },
    { assetId: 'asset-2', publisherId: 'wordpress', jobId: 'job-2' },
  ],
  skipped: [{ assetId: 'asset-1', publisherId: 'ghost', reason: 'Duplicate slug' }],
  failures: [{ assetId: 'asset-3', publisherId: 'unknown', reason: 'Not registered' }],
  summary: { assets: 3, publishers: 2, pairs: 6, accepted: 2, skipped: 1, failures: 1 },
};

function makeMockComposer(overrides: Partial<ContentComposerService> = {}): ContentComposerService {
  return {
    listEligibleAssets: vi.fn(),
    getComposerAsset: vi.fn(),
    validate: vi.fn(),
    publish: vi.fn(),
    bulkPublish: vi.fn().mockResolvedValue(bulkResult),
    ...overrides,
  };
}

function makeMockEnqueuer(): PublishingQueueEnqueuer {
  return { enqueue: vi.fn().mockResolvedValue('job-1'), close: vi.fn() };
}

describe('POST /composer/bulk-publish', () => {
  it('returns 202 with batch summary', async () => {
    const composer = makeMockComposer();
    const app = buildApp({
      config: baseConfig,
      composerService: composer,
      publishingEnqueuer: makeMockEnqueuer(),
      authConfig,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/bulk-publish',
      headers: { 'x-api-key': 'smoke-key' },
      payload: {
        assetIds: ['asset-1', 'asset-2', 'asset-3'],
        publisherIds: ['wordpress', 'ghost'],
      },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json() as ComposerBulkPublishResult;
    expect(body.summary.accepted).toBe(2);
    expect(body.accepted).toHaveLength(2);
    expect(composer.bulkPublish).toHaveBeenCalledWith({
      projectId: 'proj-abc',
      assetIds: ['asset-1', 'asset-2', 'asset-3'],
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
      url: '/composer/bulk-publish',
      payload: { assetIds: ['asset-1'], publisherIds: ['wordpress'] },
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
    const res = await app.inject({
      method: 'POST',
      url: '/composer/bulk-publish',
      headers: { 'x-api-key': 'smoke-key' },
      payload: { assetIds: ['asset-1'], publisherIds: ['wordpress'] },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it('returns 400 when assetIds empty', async () => {
    const app = buildApp({
      config: baseConfig,
      composerService: makeMockComposer(),
      publishingEnqueuer: makeMockEnqueuer(),
      authConfig,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/bulk-publish',
      headers: { 'x-api-key': 'smoke-key' },
      payload: { assetIds: [], publisherIds: ['wordpress'] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
