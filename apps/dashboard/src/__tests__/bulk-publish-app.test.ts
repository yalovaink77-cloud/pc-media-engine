import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type {
  ComposerAssetListResult,
  ComposerBulkPublishResult,
  PublisherListItem,
} from '../types.js';

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

const publishers: PublisherListItem[] = [
  {
    id: 'wordpress',
    displayName: 'WordPress',
    version: '1.0.0',
    enabled: true,
    capabilities: {
      mediaUpload: true,
      postCreation: true,
      drafts: true,
      tags: true,
      categories: true,
      featuredImages: true,
      scheduling: false,
      update: false,
      delete: false,
    },
    supportsHealthCheck: true,
  },
];

const bulkResult: ComposerBulkPublishResult = {
  accepted: [{ assetId: 'asset-001', publisherId: 'wordpress', jobId: 'job-1' }],
  skipped: [],
  failures: [],
  summary: { assets: 1, publishers: 1, pairs: 1, accepted: 1, skipped: 0, failures: 0 },
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
    fetchPublishers: async () => publishers,
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => ({ jobs: [], total: 0, limit: 50, offset: 0 }),
    fetchJob: async () => null,
    fetchAssets: async () => null,
    fetchAsset: async () => null,
    fetchComposerAssets: async () => assetList,
    fetchComposerAsset: async () => null,
    validateComposer: async () => null,
    publishComposer: async () => null,
    bulkPublishComposer: async () => bulkResult,
    fetchCalendarEvents: async () => null,
    fetchCalendarTimeline: async () => null,
    fetchProviderConfigs: async () => null,
    fetchProviderConfig: async () => null,
    validateProviderConfig: async () => null,
    updateProviderConfig: async () => ({ ok: false, status: 0, detail: null, validation: null }),
    ...overrides,
  };
}

let app: ReturnType<typeof buildDashboardApp>;

afterEach(async () => {
  await app.close();
});

describe('GET /bulk-publish', () => {
  beforeEach(() => {
    app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
  });

  it('renders bulk publish page with selectors', async () => {
    const res = await app.inject({ method: 'GET', url: '/bulk-publish' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="bulk-publish-section"');
    expect(res.body).toContain('data-testid="bulk-asset-multiselect"');
    expect(res.body).toContain('data-testid="bulk-publisher-multiselect"');
  });
});

describe('POST /ops/bulk-publish', () => {
  beforeEach(() => {
    app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
  });

  it('redirects to confirmation without confirm flag', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ops/bulk-publish',
      payload: { assetIds: ['asset-001'], publisherIds: ['wordpress'] },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('confirmBulkPublish=1');
    expect(res.headers.location).toContain('assets=asset-001');
  });

  it('redirects with bulk summary after confirmation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ops/bulk-publish',
      payload: { assetIds: ['asset-001'], publisherIds: ['wordpress'], confirm: 'true' },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('bulkSummary=');
  });
});
