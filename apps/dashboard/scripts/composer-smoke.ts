/**
 * Content composer dashboard smoke — Sprint 40–41.
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type { ComposerAssetDetail, ComposerAssetListResult } from '../src/types.js';

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
      id: 'asset-smoke-1',
      projectId: 'proj-1',
      filename: 'smoke.jpg',
      mimeType: 'image/jpeg',
      status: 'ready',
      readiness: 'ready',
      thumbnail: { url: '/assets/asset-smoke-1/thumbnail' },
      publisherCount: 0,
      createdAt: '2024-06-01T10:00:00.000Z',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const assetDetail: ComposerAssetDetail = {
  id: 'asset-smoke-1',
  projectId: 'proj-1',
  filename: 'smoke.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 4096,
  status: 'ready',
  thumbnail: { url: '/assets/asset-smoke-1/thumbnail' },
  tags: ['smoke'],
  seo: {
    slug: 'smoke',
    seoTitle: 'Smoke',
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
  preview: { title: 'Smoke', slug: 'smoke', body: '<p>Body</p>' },
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
    fetchAssets: async () => null,
    fetchAsset: async () => null,
    fetchComposerAssets: async () => assetList,
    fetchComposerAsset: async (id) => (id === 'asset-smoke-1' ? assetDetail : null),
    validateComposer: async () => ({
      ready: true,
      messages: [],
      warnings: [],
      publisherCompatibility: { publisherId: 'wordpress', compatible: true, gaps: [] },
      missingRequirements: [],
    }),
    publishComposer: async () => ({
      assetId: 'asset-smoke-1',
      accepted: [{ publisherId: 'wordpress', jobId: 'job-1' }],
      skipped: [],
      failures: [],
    }),
    bulkPublishComposer: async () => null,
    fetchCalendarEvents: async () => null,
    fetchCalendarTimeline: async () => null,
    fetchProviderConfigs: async () => null,
    fetchProviderConfig: async () => null,
    validateProviderConfig: async () => null,
    updateProviderConfig: async () => ({ ok: false, status: 0, detail: null, validation: null }),
  };
}

async function main(): Promise<void> {
  const app = buildDashboardApp({
    client: makeClient(),
    apiBaseUrl: 'http://api.test',
  });
  await app.ready();

  section('1 · Composer page');
  {
    const res = await app.inject({ method: 'GET', url: '/composer?assetId=asset-smoke-1' });
    assert(res.statusCode === 200, 'GET /composer returns 200');
    assert(res.body.includes('data-testid="composer-asset-selector"'), 'asset selector present');
    assert(res.body.includes('data-testid="composer-detail-section"'), 'detail section present');
    assert(res.body.includes('data-testid="composer-readiness-badge"'), 'readiness badge present');
    assert(res.body.includes('data-testid="composer-seo-section"'), 'SEO section present');
    assert(res.body.includes('data-testid="composer-ai-section"'), 'AI section present');
    assert(res.body.includes('data-testid="composer-publish-button"'), 'publish button present');
    assert(res.body.includes('href="/composer"'), 'composer nav link present');
  }

  section('2 · Publish flow');
  {
    const res = await app.inject({
      method: 'POST',
      url: '/ops/composer/publish',
      payload: { assetId: 'asset-smoke-1', publisherIds: 'wordpress' },
    });
    assert(res.statusCode === 302, 'publish redirects to confirm');
    const confirm = await app.inject({ method: 'GET', url: res.headers.location ?? '' });
    assert(confirm.body.includes('data-testid="composer-confirm-dialog"'), 'confirm dialog shown');

    const done = await app.inject({
      method: 'POST',
      url: '/ops/composer/publish',
      payload: { assetId: 'asset-smoke-1', publisherIds: 'wordpress', confirm: 'true' },
    });
    assert(done.statusCode === 302, 'confirmed publish redirects');
    const page = await app.inject({ method: 'GET', url: done.headers.location ?? '' });
    assert(page.body.includes('data-testid="composer-publish-result"'), 'publish result shown');
  }

  await app.close();
  console.log('\n✅  All content composer dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
