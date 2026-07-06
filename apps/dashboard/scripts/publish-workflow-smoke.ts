/**
 * Sprint 41 — Multi-Publisher Publish Workflow dashboard smoke (offline).
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type {
  ComposerAssetDetail,
  ComposerAssetListResult,
  ComposerPublishResult,
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
    { id: 'ghost', displayName: 'Ghost', enabled: true, compatible: true, gaps: [] },
  ],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  preview: { title: 'Smoke', slug: 'smoke', body: '<p>Body</p>' },
};

const mixedResult: ComposerPublishResult = {
  assetId: 'asset-smoke-1',
  accepted: [{ publisherId: 'wordpress', jobId: 'job-1' }],
  skipped: [{ publisherId: 'ghost', reason: 'Duplicate slug "smoke" already published to ghost' }],
  failures: [{ publisherId: 'unknown', reason: 'Publisher "unknown" is not registered' }],
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
    publishComposer: async () => mixedResult,
  };
}

async function main(): Promise<void> {
  const app = buildDashboardApp({
    client: makeClient(),
    apiBaseUrl: 'http://api.test',
  });
  await app.ready();

  section('1 · Composer publish UI');
  {
    const res = await app.inject({ method: 'GET', url: '/composer?assetId=asset-smoke-1' });
    assert(res.statusCode === 200, 'GET /composer returns 200');
    assert(res.body.includes('data-testid="composer-publish-button"'), 'publish button present');
    assert(
      res.body.includes('data-testid="composer-publisher-multiselect"'),
      'multi-select present',
    );
    assert(res.body.includes('value="wordpress"'), 'wordpress checkbox');
    assert(res.body.includes('value="ghost"'), 'ghost checkbox');
  }

  section('2 · Confirmation dialog');
  {
    const res = await app.inject({
      method: 'GET',
      url: '/composer?assetId=asset-smoke-1&confirmPublish=1&publishers=wordpress,ghost',
    });
    assert(res.body.includes('data-testid="composer-confirm-dialog"'), 'confirm dialog shown');
    assert(res.body.includes('data-testid="composer-confirm-button"'), 'confirm button present');
  }

  section('3 · Publish flow');
  {
    const step1 = await app.inject({
      method: 'POST',
      url: '/ops/composer/publish',
      payload: { assetId: 'asset-smoke-1', publisherIds: ['wordpress', 'ghost'] },
    });
    assert(step1.statusCode === 302, 'first POST redirects to confirm');
    assert(step1.headers.location?.includes('confirmPublish=1'), 'confirm query param set');

    const step2 = await app.inject({
      method: 'POST',
      url: '/ops/composer/publish',
      payload: {
        assetId: 'asset-smoke-1',
        publisherIds: ['wordpress', 'ghost'],
        confirm: 'true',
      },
    });
    assert(step2.statusCode === 302, 'confirmed POST redirects with summary');
    assert(step2.headers.location?.includes('publishSummary='), 'summary encoded in URL');

    const page = await app.inject({ method: 'GET', url: step2.headers.location ?? '' });
    assert(page.body.includes('data-testid="composer-publish-result"'), 'publish result shown');
    assert(page.body.includes('data-testid="publish-queued-wordpress"'), 'queued wordpress');
    assert(page.body.includes('data-testid="publish-skipped-ghost"'), 'skipped ghost');
    assert(page.body.includes('data-testid="publish-failure-unknown"'), 'failure shown');
  }

  await app.close();
  console.log('\n✅  All publish workflow dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
