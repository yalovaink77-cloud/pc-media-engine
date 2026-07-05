import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type {
  HistoryItem,
  HistoryResponse,
  PublishingHealthResponse,
} from '../routes/publishing.js';
import type { PublishedContentFinder } from '../routes/publishing.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.0.0-test',
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

const NOW = new Date('2024-06-01T12:00:00.000Z');

function makeRecord(overrides: Partial<HistoryItem & { createdAt: Date; publishedAt: Date }> = {}) {
  return {
    id: 'rec-001',
    projectId: 'proj-abc',
    assetId: 'asset-xyz',
    publisher: 'mock',
    externalId: 'ext-1',
    url: 'https://example.com/posts/1',
    status: 'PUBLISHED',
    publishedAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

function makeMockRepo(records: ReturnType<typeof makeRecord>[]): PublishedContentFinder {
  return {
    async findHistory(opts) {
      let results = [...records];
      if (opts.projectId) results = results.filter((r) => r.projectId === opts.projectId);
      if (opts.assetId) results = results.filter((r) => r.assetId === opts.assetId);
      if (opts.publisher) results = results.filter((r) => r.publisher === opts.publisher);
      return results.slice(0, opts.limit) as never;
    },
    async findById(id) {
      return (records.find((r) => r.id === id) ?? null) as never;
    },
  };
}

function makeApp(overrides: Partial<AppOptions> = {}) {
  return buildApp({ config: baseConfig, ...overrides });
}

let app: ReturnType<typeof buildApp>;

afterEach(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// GET /publishing/health
// ---------------------------------------------------------------------------

describe('GET /publishing/health', () => {
  beforeEach(() => {
    app = makeApp();
  });

  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/health' });
    expect(res.statusCode).toBe(200);
  });

  it('returns status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/health' });
    const body = res.json<PublishingHealthResponse>();
    expect(body.status).toBe('ok');
  });

  it('includes publisher driver from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/health' });
    const body = res.json<PublishingHealthResponse>();
    expect(body.publisherDriver).toBe('mock');
  });

  it('includes retry config from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/health' });
    const body = res.json<PublishingHealthResponse>();
    expect(body.retryConfig).toEqual({ maxRetries: 3, backoffMs: 5000 });
  });

  it('scheduler always enabled', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/health' });
    const body = res.json<PublishingHealthResponse>();
    expect(body.schedulerEnabled).toBe(true);
  });

  it('duplicate detection always enabled', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/health' });
    const body = res.json<PublishingHealthResponse>();
    expect(body.duplicateDetectionEnabled).toBe(true);
  });

  it('includes worker version from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/health' });
    const body = res.json<PublishingHealthResponse>();
    expect(body.workerVersion).toBe('0.0.0-test');
  });

  it('includes AI metadata provider from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/health' });
    const body = res.json<PublishingHealthResponse>();
    expect(body.aiMetadataProvider).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// GET /publishing/history
// ---------------------------------------------------------------------------

describe('GET /publishing/history', () => {
  const records = [
    makeRecord({ id: 'rec-001', projectId: 'proj-a', assetId: 'asset-1', publisher: 'mock' }),
    makeRecord({ id: 'rec-002', projectId: 'proj-a', assetId: 'asset-2', publisher: 'wordpress' }),
    makeRecord({ id: 'rec-003', projectId: 'proj-b', assetId: 'asset-3', publisher: 'mock' }),
  ];

  beforeEach(() => {
    app = makeApp({ publishedContentRepo: makeMockRepo(records) });
  });

  it('returns 200 with items and count', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history' });
    expect(res.statusCode).toBe(200);
    const body = res.json<HistoryResponse>();
    expect(body.count).toBe(3);
    expect(body.items).toHaveLength(3);
  });

  it('items include expected fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history' });
    const body = res.json<HistoryResponse>();
    const item = body.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('projectId');
    expect(item).toHaveProperty('assetId');
    expect(item).toHaveProperty('publisher');
    expect(item).toHaveProperty('externalId');
    expect(item).toHaveProperty('url');
    expect(item).toHaveProperty('status');
    expect(item).toHaveProperty('publishedAt');
    expect(item).toHaveProperty('createdAt');
  });

  it('filters by projectId', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history?projectId=proj-a' });
    const body = res.json<HistoryResponse>();
    expect(body.count).toBe(2);
    expect(body.items.every((i) => i.projectId === 'proj-a')).toBe(true);
  });

  it('filters by assetId', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history?assetId=asset-1' });
    const body = res.json<HistoryResponse>();
    expect(body.count).toBe(1);
    expect(body.items[0]?.assetId).toBe('asset-1');
  });

  it('filters by publisher', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history?publisher=wordpress' });
    const body = res.json<HistoryResponse>();
    expect(body.count).toBe(1);
    expect(body.items[0]?.publisher).toBe('wordpress');
  });

  it('respects limit parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history?limit=2' });
    const body = res.json<HistoryResponse>();
    expect(body.count).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it('returns 400 for limit exceeding max', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history?limit=201' });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string }>();
    expect(body.error).toMatch(/201|200|limit/i);
  });

  it('returns 400 for non-integer limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history?limit=abc' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for negative limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/history?limit=-1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 503 when repo not configured', async () => {
    const noRepoApp = buildApp({ config: baseConfig });
    const res = await noRepoApp.inject({ method: 'GET', url: '/publishing/history' });
    expect(res.statusCode).toBe(503);
    await noRepoApp.close();
  });
});

// ---------------------------------------------------------------------------
// GET /publishing/:id
// ---------------------------------------------------------------------------

describe('GET /publishing/:id', () => {
  const records = [makeRecord({ id: 'rec-001' })];

  beforeEach(() => {
    app = makeApp({ publishedContentRepo: makeMockRepo(records) });
  });

  it('returns 200 for an existing id', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/rec-001' });
    expect(res.statusCode).toBe(200);
    const body = res.json<HistoryItem>();
    expect(body.id).toBe('rec-001');
  });

  it('returns all expected fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/rec-001' });
    const body = res.json<HistoryItem>();
    expect(body).toMatchObject({
      id: 'rec-001',
      projectId: 'proj-abc',
      assetId: 'asset-xyz',
      publisher: 'mock',
      externalId: 'ext-1',
      url: 'https://example.com/posts/1',
      status: 'PUBLISHED',
    });
    expect(typeof body.publishedAt).toBe('string');
    expect(typeof body.createdAt).toBe('string');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishing/unknown-id-xyz' });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: string }>();
    expect(body.error).toContain('unknown-id-xyz');
  });

  it('returns 503 when repo not configured', async () => {
    const noRepoApp = buildApp({ config: baseConfig });
    const res = await noRepoApp.inject({ method: 'GET', url: '/publishing/rec-001' });
    expect(res.statusCode).toBe(503);
    await noRepoApp.close();
  });

  it('does not conflict with /publishing/health path', async () => {
    const healthRes = await app.inject({ method: 'GET', url: '/publishing/health' });
    expect(healthRes.statusCode).toBe(200);
    const body = healthRes.json<PublishingHealthResponse>();
    expect(body.status).toBe('ok');
  });
});
