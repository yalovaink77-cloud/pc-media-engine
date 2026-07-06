/**
 * Sprint 42 — Bulk Publishing dashboard smoke (offline).
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type {
  ComposerAssetListResult,
  ComposerBulkPublishResult,
  PublisherListItem,
} from '../src/types.js';

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

const assetList: ComposerAssetListResult = {
  assets: [
    {
      id: 'asset-1',
      projectId: 'proj-1',
      filename: 'alpha.jpg',
      mimeType: 'image/jpeg',
      status: 'ready',
      readiness: 'ready',
      publisherCount: 0,
      createdAt: '2024-06-01T10:00:00.000Z',
    },
    {
      id: 'asset-2',
      projectId: 'proj-1',
      filename: 'beta.jpg',
      mimeType: 'image/jpeg',
      status: 'ready',
      readiness: 'ready',
      publisherCount: 0,
      createdAt: '2024-06-01T10:00:00.000Z',
    },
  ],
  total: 2,
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
  {
    id: 'ghost',
    displayName: 'Ghost',
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
  accepted: [
    { assetId: 'asset-1', publisherId: 'wordpress', jobId: 'job-1' },
    { assetId: 'asset-2', publisherId: 'wordpress', jobId: 'job-2' },
  ],
  skipped: [{ assetId: 'asset-1', publisherId: 'ghost', reason: 'Duplicate slug' }],
  failures: [{ assetId: 'asset-2', publisherId: 'unknown', reason: 'Not registered' }],
  summary: { assets: 2, publishers: 2, pairs: 4, accepted: 2, skipped: 1, failures: 1 },
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
  };
}

async function main(): Promise<void> {
  const app = buildDashboardApp({ client: makeClient(), apiBaseUrl: 'http://api.test' });
  await app.ready();

  section('1 · Bulk publish page');
  {
    const res = await app.inject({ method: 'GET', url: '/bulk-publish' });
    assert(res.statusCode === 200, 'GET /bulk-publish returns 200');
    assert(res.body.includes('data-testid="bulk-publish-section"'), 'bulk section present');
    assert(res.body.includes('data-testid="bulk-asset-multiselect"'), 'asset multiselect');
    assert(res.body.includes('data-testid="bulk-publisher-multiselect"'), 'publisher multiselect');
    assert(res.body.includes('data-testid="bulk-publish-summary-panel"'), 'summary panel');
    assert(res.body.includes('href="/bulk-publish"'), 'nav link present');
  }

  section('2 · Confirmation dialog');
  {
    const res = await app.inject({
      method: 'GET',
      url: '/bulk-publish?confirmBulkPublish=1&assets=asset-1,asset-2&publishers=wordpress,ghost',
    });
    assert(res.body.includes('data-testid="bulk-confirm-dialog"'), 'confirm dialog shown');
    assert(res.body.includes('data-testid="bulk-confirm-button"'), 'confirm button');
  }

  section('3 · Bulk publish flow');
  {
    const step1 = await app.inject({
      method: 'POST',
      url: '/ops/bulk-publish',
      payload: { assetIds: ['asset-1', 'asset-2'], publisherIds: ['wordpress', 'ghost'] },
    });
    assert(step1.statusCode === 302, 'redirects to confirm');
    assert(step1.headers.location?.includes('confirmBulkPublish=1'), 'confirm param set');

    const step2 = await app.inject({
      method: 'POST',
      url: '/ops/bulk-publish',
      payload: {
        assetIds: ['asset-1', 'asset-2'],
        publisherIds: ['wordpress', 'ghost'],
        confirm: 'true',
      },
    });
    assert(step2.statusCode === 302, 'confirmed redirect');
    assert(step2.headers.location?.includes('bulkSummary='), 'result in URL');

    const page = await app.inject({ method: 'GET', url: step2.headers.location ?? '' });
    assert(page.body.includes('data-testid="bulk-publish-result"'), 'result shown');
    assert(page.body.includes('data-testid="bulk-queued-asset-1-wordpress"'), 'queued job');
    assert(page.body.includes('data-testid="bulk-skipped-asset-1-ghost"'), 'duplicate skipped');
    assert(page.body.includes('data-testid="bulk-failure-asset-2-unknown"'), 'validation failure');
  }

  await app.close();
  console.log('\n✅  All bulk publishing dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
