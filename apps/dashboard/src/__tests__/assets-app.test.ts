import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type { AssetDetail, AssetListResult } from '../types.js';

const assetList: AssetListResult = {
  assets: [
    {
      id: 'asset-001',
      projectId: 'proj-abc',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 204800,
      status: 'ready',
      dimensions: { width: 1920, height: 1080 },
      thumbnail: { url: '/assets/asset-001/thumbnail' },
      publisherCount: 1,
      createdAt: '2024-06-01T10:00:00.000Z',
      updatedAt: '2024-06-01T10:05:00.000Z',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const assetDetail: AssetDetail = {
  ...assetList.assets[0]!,
  originalFilename: 'photo.jpg',
  storageKey: 'proj/photo.jpg',
  storageProvider: 'local',
  tags: [],
  processingTimeline: [],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  metadata: {},
};

function makeClient(overrides: Partial<DashboardApiClient> = {}): DashboardApiClient {
  const noop = async () => ({ ok: true, status: 200, message: 'OK' });
  return {
    fetchHealth: async () => null,
    fetchSummary: async () => null,
    fetchRecent: async () => null,
    fetchMetrics: async () => null,
    fetchQueueStatus: async () => null,
    pauseQueue: noop,
    resumeQueue: noop,
    drainQueue: noop,
    retryJob: noop,
    removeJob: noop,
    fetchPublishers: async () => [],
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => ({ jobs: [], total: 0, limit: 50, offset: 0 }),
    fetchJob: async () => null,
    fetchAssets: async () => assetList,
    fetchAsset: async (id) => (id === 'asset-001' ? assetDetail : null),
    fetchComposerAssets: async () => null,
    fetchComposerAsset: async () => null,
    validateComposer: async () => null,
    publishComposer: async () => null,
    bulkPublishComposer: async () => null,
    fetchCalendarEvents: async () => null,
    fetchCalendarTimeline: async () => null,
    ...overrides,
  };
}

let app: ReturnType<typeof buildDashboardApp>;

afterEach(async () => {
  await app.close();
});

describe('GET /assets', () => {
  beforeEach(() => {
    app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
  });

  it('returns 200 with assets table', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('data-testid="assets-table"');
    expect(res.body).toContain('asset-001');
  });

  it('passes filters to client', async () => {
    let captured: Record<string, unknown> | undefined;
    app = buildDashboardApp({
      client: makeClient({
        fetchAssets: async (filters) => {
          captured = filters;
          return assetList;
        },
      }),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
    await app.inject({
      method: 'GET',
      url: '/assets?status=ready&mimeType=image/jpeg&limit=10&offset=5',
    });
    expect(captured).toEqual({
      status: 'ready',
      mimeType: 'image/jpeg',
      limit: 10,
      offset: 5,
    });
  });

  it('shows error when API unavailable', async () => {
    app = buildDashboardApp({
      client: makeClient({ fetchAssets: async () => null }),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
    const res = await app.inject({ method: 'GET', url: '/assets' });
    expect(res.body).toContain('data-testid="error-banner"');
    expect(res.body).toContain('data-testid="assets-unavailable"');
  });
});

describe('GET /assets/:id', () => {
  beforeEach(() => {
    app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
  });

  it('returns asset detail page', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/asset-001' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="asset-detail-section"');
    expect(res.body).toContain('photo.jpg');
  });

  it('shows error for missing asset', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/missing' });
    expect(res.body).toContain('data-testid="asset-unavailable"');
  });
});
