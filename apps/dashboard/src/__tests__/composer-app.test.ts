import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type { ComposerAssetDetail, ComposerAssetListResult } from '../types.js';

const assetList: ComposerAssetListResult = {
  assets: [
    {
      id: 'asset-001',
      projectId: 'proj-abc',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      status: 'ready',
      readiness: 'ready',
      publisherCount: 0,
      createdAt: '2024-06-01T10:00:00.000Z',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const assetDetail: ComposerAssetDetail = {
  id: 'asset-001',
  projectId: 'proj-abc',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 204800,
  status: 'ready',
  tags: [],
  seo: {
    slug: 'photo',
    seoTitle: 'Photo',
    excerpt: 'Excerpt',
    metaDescription: 'Meta',
    readingTimeMinutes: 1,
    tags: [],
    categories: [],
  },
  ai: { provider: 'none', aiApplied: false },
  readiness: { ready: true, blockers: [], warnings: [] },
  validationWarnings: [],
  compatiblePublishers: [
    { id: 'wordpress', displayName: 'WordPress', enabled: true, compatible: true, gaps: [] },
  ],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  preview: { title: 'Photo', slug: 'photo', body: '<p>Body</p>' },
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
    fetchAssets: async () => null,
    fetchAsset: async () => null,
    fetchComposerAssets: async () => assetList,
    fetchComposerAsset: async (id) => (id === 'asset-001' ? assetDetail : null),
    validateComposer: async () => ({
      ready: true,
      messages: [],
      warnings: [],
      publisherCompatibility: { publisherId: 'wordpress', compatible: true, gaps: [] },
      missingRequirements: [],
    }),
    ...overrides,
  };
}

let app: ReturnType<typeof buildDashboardApp>;

afterEach(async () => {
  await app.close();
});

describe('GET /composer', () => {
  beforeEach(() => {
    app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
  });

  it('returns composer page with asset selector', async () => {
    const res = await app.inject({ method: 'GET', url: '/composer' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="composer-asset-selector"');
    expect(res.body).toContain('data-testid="composer-empty"');
  });

  it('shows detail when asset selected', async () => {
    const res = await app.inject({ method: 'GET', url: '/composer?assetId=asset-001' });
    expect(res.body).toContain('data-testid="composer-detail-section"');
    expect(res.body).toContain('data-testid="composer-seo-section"');
    expect(res.body).toContain('data-testid="composer-readiness-badge"');
  });
});

describe('POST /ops/composer/validate', () => {
  beforeEach(() => {
    app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
  });

  it('redirects with validation query params', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ops/composer/validate',
      payload: { assetId: 'asset-001', publisherId: 'wordpress' },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('validated=1');
    expect(res.headers.location).toContain('assetId=asset-001');
    expect(res.headers.location).toContain('publisherId=wordpress');
  });
});
