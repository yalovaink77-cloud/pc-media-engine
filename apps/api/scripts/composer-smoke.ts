/**
 * Content composer API smoke — Sprint 40.
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type {
  ComposerAssetDetail,
  ComposerAssetListItem,
  ContentComposerService,
} from '../src/composer/types.js';

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

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.40.0-smoke',
  databaseUrl: 'postgres://test',
  storageLocalRoot: '/tmp/storage',
  defaultOrgId: 'org-1',
  defaultProjectId: 'proj-smoke',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const listItem: ComposerAssetListItem = {
  id: 'asset-smoke-1',
  projectId: 'proj-smoke',
  filename: 'smoke.jpg',
  mimeType: 'image/jpeg',
  status: 'ready',
  readiness: 'ready',
  thumbnail: { url: '/assets/asset-smoke-1/thumbnail' },
  publisherCount: 0,
  createdAt: '2024-06-01T10:00:00.000Z',
};

const detail: ComposerAssetDetail = {
  id: 'asset-smoke-1',
  projectId: 'proj-smoke',
  filename: 'smoke.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 4096,
  status: 'ready',
  dimensions: { width: 800, height: 600 },
  thumbnail: { url: '/assets/asset-smoke-1/thumbnail' },
  tags: ['smoke'],
  seo: {
    slug: 'smoke',
    seoTitle: 'Smoke',
    excerpt: 'Publish-ready content for smoke.',
    metaDescription: 'Publish-ready content for smoke.',
    readingTimeMinutes: 1,
    tags: [],
    categories: [],
  },
  ai: { provider: 'none', aiApplied: false, message: 'Deterministic metadata unchanged' },
  readiness: { ready: true, blockers: [], warnings: [] },
  validationWarnings: [],
  compatiblePublishers: [
    { id: 'wordpress', displayName: 'WordPress', enabled: true, compatible: true, gaps: [] },
  ],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  preview: { title: 'Smoke', slug: 'smoke', body: '<p>Publish-ready content for smoke.</p>' },
};

function makeMockComposer(): ContentComposerService {
  return {
    listEligibleAssets: async () => ({ assets: [listItem], total: 1, limit: 50, offset: 0 }),
    getComposerAsset: async (_p, id) => (id === 'asset-smoke-1' ? detail : null),
    validate: async (input) => ({
      ready: input.publisherId === 'wordpress',
      messages: input.publisherId === 'wordpress' ? [] : ['Publisher is not enabled'],
      warnings: [],
      publisherCompatibility: {
        publisherId: input.publisherId,
        compatible: input.publisherId === 'wordpress',
        gaps: input.publisherId === 'wordpress' ? [] : ['Publisher not enabled'],
      },
      missingRequirements: [],
    }),
  };
}

async function main(): Promise<void> {
  const app = buildApp({ config: baseConfig, composerService: makeMockComposer() });
  await app.ready();

  section('1 · List composer assets');
  {
    const res = await app.inject({ method: 'GET', url: '/composer/assets' });
    assert(res.statusCode === 200, 'GET /composer/assets returns 200');
    const body = res.json() as { assets: ComposerAssetListItem[] };
    assert(body.assets[0]?.readiness === 'ready', 'readiness badge present');
  }

  section('2 · Composer asset detail');
  {
    const res = await app.inject({ method: 'GET', url: '/composer/assets/asset-smoke-1' });
    assert(res.statusCode === 200, 'GET /composer/assets/:id returns 200');
    const body = res.json() as ComposerAssetDetail;
    assert(body.seo.slug === 'smoke', 'SEO metadata included');
    assert(body.ai.provider === 'none', 'AI enrichment included');
    assert(body.readiness.ready === true, 'readiness included');
    assert(body.compatiblePublishers.length === 1, 'publisher compatibility included');
  }

  section('3 · Validate');
  {
    const ok = await app.inject({
      method: 'POST',
      url: '/composer/validate',
      payload: { assetId: 'asset-smoke-1', publisherId: 'wordpress' },
    });
    assert(ok.statusCode === 200, 'validate returns 200');
    assert((ok.json() as { ready: boolean }).ready === true, 'wordpress validation passes');

    const bad = await app.inject({
      method: 'POST',
      url: '/composer/validate',
      payload: { assetId: 'asset-smoke-1', publisherId: 'ghost' },
    });
    assert((bad.json() as { ready: boolean }).ready === false, 'incompatible publisher fails');
  }

  section('4 · Service unavailable');
  {
    const offline = buildApp({ config: baseConfig });
    await offline.ready();
    const res = await offline.inject({ method: 'GET', url: '/composer/assets' });
    assert(res.statusCode === 503, '503 when composer not configured');
    await offline.close();
  }

  await app.close();
  console.log('\n✅  All content composer API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
