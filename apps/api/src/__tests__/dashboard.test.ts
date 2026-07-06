import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type {
  DashboardDataProvider,
  DashboardHealthResponse,
  DashboardRecentResponse,
  DashboardSummaryResponse,
} from '../routes/dashboard.js';

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

function makePublishedRecord(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: 'org-001',
    projectId: 'proj-abc',
    assetId: `asset-${id}`,
    slug: `slug-${id}`,
    publisher: 'mock',
    externalId: `ext-${id}`,
    url: `https://example.com/posts/${id}`,
    status: 'published',
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMockRepo(
  records: ReturnType<typeof makePublishedRecord>[],
  statsOverride?: Partial<{
    totalPublished: number;
    totalDrafts: number;
    totalFailed: number;
    latestPublishedAt: Date | null;
    publishers: Array<{ publisher: string; count: number }>;
  }>,
): DashboardDataProvider {
  const defaultStats = {
    totalPublished: records.filter((r) => r.status === 'published').length,
    totalDrafts: records.filter((r) => r.status === 'draft').length,
    totalFailed: records.filter((r) => r.status === 'failed').length,
    latestPublishedAt: records.length > 0 ? NOW : null,
    publishers: [{ publisher: 'mock', count: records.length }],
    ...statsOverride,
  };

  return {
    async getSummaryStats() {
      return defaultStats;
    },
    async findRecent(limit) {
      return records.slice(0, limit) as never;
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
// GET /dashboard/health
// ---------------------------------------------------------------------------

describe('GET /dashboard/health', () => {
  beforeEach(() => {
    app = makeApp();
  });

  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
    expect(res.statusCode).toBe(200);
  });

  it('returns status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
    const body = res.json<DashboardHealthResponse>();
    expect(body.status).toBe('ok');
  });

  it('includes version from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
    const body = res.json<DashboardHealthResponse>();
    expect(body.version).toBe('0.0.0-test');
  });

  it('includes env from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
    const body = res.json<DashboardHealthResponse>();
    expect(body.env).toBe('test');
  });

  it('database is skipped when no checkDatabase injected', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
    const body = res.json<DashboardHealthResponse>();
    expect(body.database).toBe('skipped');
  });

  it('calls checkDatabase when provided', async () => {
    const appWithDb = buildApp({
      config: baseConfig,
      checkDatabase: async () => 'ok',
    });
    const res = await appWithDb.inject({ method: 'GET', url: '/dashboard/health' });
    const body = res.json<DashboardHealthResponse>();
    expect(body.database).toBe('ok');
    await appWithDb.close();
  });

  it('publishing block includes driver and retry config', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
    const body = res.json<DashboardHealthResponse>();
    expect(body.publishing.publisherDriver).toBe('mock');
    expect(body.publishing.retryConfig).toEqual({ maxRetries: 3, backoffMs: 5000 });
  });

  it('publishing block reflects queueEnabled from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
    const body = res.json<DashboardHealthResponse>();
    expect(body.publishing.queueEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /dashboard/summary
// ---------------------------------------------------------------------------

describe('GET /dashboard/summary', () => {
  const records = [
    makePublishedRecord('r1', { status: 'published' }),
    makePublishedRecord('r2', { status: 'published' }),
    makePublishedRecord('r3', { status: 'failed' }),
  ];

  beforeEach(() => {
    app = makeApp({
      dashboardRepo: makeMockRepo(records, {
        totalPublished: 2,
        totalDrafts: 0,
        totalFailed: 1,
        latestPublishedAt: NOW,
        publishers: [{ publisher: 'mock', count: 3 }],
      }),
    });
  });

  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    expect(res.statusCode).toBe(200);
  });

  it('returns correct counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    const body = res.json<DashboardSummaryResponse>();
    expect(body.totalPublished).toBe(2);
    expect(body.totalDrafts).toBe(0);
    expect(body.totalFailed).toBe(1);
  });

  it('returns latestPublishedAt as ISO string', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    const body = res.json<DashboardSummaryResponse>();
    expect(typeof body.latestPublishedAt).toBe('string');
    expect(new Date(body.latestPublishedAt!).toISOString()).toBe(NOW.toISOString());
  });

  it('returns publishers array', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    const body = res.json<DashboardSummaryResponse>();
    expect(body.publishers).toHaveLength(1);
    expect(body.publishers[0]).toEqual({ publisher: 'mock', count: 3 });
  });

  it('system flags are always true', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    const body = res.json<DashboardSummaryResponse>();
    expect(body.duplicateDetectionEnabled).toBe(true);
    expect(body.schedulerEnabled).toBe(true);
    expect(body.retryEnabled).toBe(true);
  });

  it('includes aiProvider and publisherDriver from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/summary' });
    const body = res.json<DashboardSummaryResponse>();
    expect(body.aiProvider).toBe('none');
    expect(body.publisherDriver).toBe('mock');
  });

  it('returns null for latestPublishedAt when history is empty', async () => {
    const emptyApp = buildApp({
      config: baseConfig,
      dashboardRepo: makeMockRepo([], { latestPublishedAt: null }),
    });
    const res = await emptyApp.inject({ method: 'GET', url: '/dashboard/summary' });
    const body = res.json<DashboardSummaryResponse>();
    expect(body.latestPublishedAt).toBeNull();
    expect(body.totalPublished).toBe(0);
    await emptyApp.close();
  });

  it('returns 503 when repo not configured', async () => {
    const noRepo = buildApp({ config: baseConfig });
    const res = await noRepo.inject({ method: 'GET', url: '/dashboard/summary' });
    expect(res.statusCode).toBe(503);
    await noRepo.close();
  });
});

// ---------------------------------------------------------------------------
// GET /dashboard/recent
// ---------------------------------------------------------------------------

describe('GET /dashboard/recent', () => {
  const records = Array.from({ length: 15 }, (_, i) =>
    makePublishedRecord(`r${String(i + 1).padStart(2, '0')}`),
  );

  beforeEach(() => {
    app = makeApp({ dashboardRepo: makeMockRepo(records) });
  });

  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/recent' });
    expect(res.statusCode).toBe(200);
  });

  it('defaults to 10 items', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/recent' });
    const body = res.json<DashboardRecentResponse>();
    expect(body.count).toBe(10);
    expect(body.items).toHaveLength(10);
  });

  it('respects limit parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/recent?limit=5' });
    const body = res.json<DashboardRecentResponse>();
    expect(body.count).toBe(5);
  });

  it('items include expected fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/recent' });
    const body = res.json<DashboardRecentResponse>();
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

  it('returns 400 for limit exceeding max 50', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/recent?limit=51' });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string }>();
    expect(body.error).toMatch(/51|50|limit/i);
  });

  it('returns 400 for non-integer limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/recent?limit=abc' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for zero limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard/recent?limit=0' });
    expect(res.statusCode).toBe(400);
  });

  it('returns empty items array when no history', async () => {
    const emptyApp = buildApp({ config: baseConfig, dashboardRepo: makeMockRepo([]) });
    const res = await emptyApp.inject({ method: 'GET', url: '/dashboard/recent' });
    const body = res.json<DashboardRecentResponse>();
    expect(body.items).toHaveLength(0);
    expect(body.count).toBe(0);
    await emptyApp.close();
  });

  it('returns 503 when repo not configured', async () => {
    const noRepo = buildApp({ config: baseConfig });
    const res = await noRepo.inject({ method: 'GET', url: '/dashboard/recent' });
    expect(res.statusCode).toBe(503);
    await noRepo.close();
  });
});
