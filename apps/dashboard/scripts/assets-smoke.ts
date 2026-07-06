/**
 * Asset library dashboard smoke — Sprint 39.
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type { AssetDetail, AssetListResult } from '../src/types.js';

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

const assetList: AssetListResult = {
  assets: [
    {
      id: 'asset-smoke-1',
      projectId: 'proj-1',
      filename: 'smoke.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4096,
      status: 'ready',
      dimensions: { width: 800, height: 600 },
      thumbnail: { url: '/assets/asset-smoke-1/thumbnail' },
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
  originalFilename: 'smoke.jpg',
  storageKey: 'proj/smoke.jpg',
  storageProvider: 'local',
  tags: ['smoke'],
  processingTimeline: [
    {
      id: 'proc-1',
      processingType: 'thumbnail',
      status: 'completed',
      retryCount: 0,
      createdAt: '2024-06-01T10:01:00.000Z',
      completedAt: '2024-06-01T10:02:00.000Z',
    },
  ],
  publishingHistory: [
    {
      id: 'pub-1',
      publisher: 'mock',
      status: 'published',
      url: 'https://example.com/smoke',
      slug: 'smoke',
      publishedAt: '2024-06-01T11:00:00.000Z',
    },
  ],
  publishingSummary: { total: 1, publishers: [{ publisher: 'mock', count: 1 }] },
  downloadUrl: '/assets/asset-smoke-1/download',
  metadata: { dimensions: { width_px: 800, height_px: 600 } },
};

function makeClient(): DashboardApiClient {
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
    fetchAsset: async (id) => (id === 'asset-smoke-1' ? assetDetail : null),
  };
}

async function main(): Promise<void> {
  const app = buildDashboardApp({
    client: makeClient(),
    apiBaseUrl: 'http://api.test',
  });
  await app.ready();

  section('1 · Assets page');
  {
    const res = await app.inject({ method: 'GET', url: '/assets' });
    assert(res.statusCode === 200, 'GET /assets returns 200');
    assert(res.body.includes('data-testid="assets-table"'), 'assets table present');
    assert(res.body.includes('data-testid="assets-filter-form"'), 'filter form present');
    assert(res.body.includes('asset-smoke-1'), 'asset id in table');
    assert(res.body.includes('href="/assets/asset-smoke-1"'), 'detail link present');
    assert(res.body.includes('href="/assets"'), 'assets nav link present');
  }

  section('2 · Asset detail page');
  {
    const res = await app.inject({ method: 'GET', url: '/assets/asset-smoke-1' });
    assert(res.statusCode === 200, 'detail page returns 200');
    assert(res.body.includes('data-testid="asset-detail-section"'), 'detail section present');
    assert(res.body.includes('Processing timeline'), 'processing timeline shown');
    assert(res.body.includes('Publishing history'), 'publishing history shown');
    assert(res.body.includes('data-testid="asset-download-link"'), 'download link present');
    assert(
      res.body.includes('http://api.test/assets/asset-smoke-1/download'),
      'download URL resolved',
    );
  }

  section('3 · Pagination filters');
  {
    const res = await app.inject({
      method: 'GET',
      url: '/assets?status=ready&limit=10&offset=0',
    });
    assert(res.statusCode === 200, 'filtered assets page returns 200');
    assert(res.body.includes('value="ready" selected'), 'status filter preserved');
  }

  await app.close();
  console.log('\n✅  All asset library dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
