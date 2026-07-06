/**
 * Asset library API smoke — Sprint 39.
 *
 * Offline — uses mocked AssetLibraryService via fastify.inject().
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { AssetDetail, AssetLibraryService, AssetListItem } from '../src/assets/types.js';

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
  version: '0.39.0-smoke',
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

const listItem: AssetListItem = {
  id: 'asset-smoke-1',
  projectId: 'proj-smoke',
  filename: 'smoke.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 4096,
  status: 'ready',
  dimensions: { width: 800, height: 600 },
  thumbnail: { url: '/assets/asset-smoke-1/thumbnail' },
  publisherCount: 1,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:05:00.000Z',
};

const detail: AssetDetail = {
  ...listItem,
  originalFilename: 'smoke.jpg',
  storageKey: 'piercingconnect/asset-smoke-1/smoke.jpg',
  storageProvider: 'local',
  tags: ['smoke'],
  processingTimeline: [
    {
      id: 'proc-smoke-1',
      processingType: 'thumbnail',
      status: 'completed',
      retryCount: 0,
      createdAt: '2024-06-01T10:01:00.000Z',
      completedAt: '2024-06-01T10:02:00.000Z',
    },
  ],
  publishingHistory: [
    {
      id: 'pub-smoke-1',
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

function makeMockLibrary(): AssetLibraryService {
  return {
    listAssets: async () => ({ assets: [listItem], total: 1, limit: 50, offset: 0 }),
    getAsset: async (_projectId, id) => (id === 'asset-smoke-1' ? detail : null),
    getAssetStorageKey: async () => 'piercingconnect/asset-smoke-1/smoke.jpg',
    getThumbnailStorageKey: async () => 'piercingconnect/asset-smoke-1/smoke_thumb.webp',
  };
}

async function main(): Promise<void> {
  const app = buildApp({ config: baseConfig, assetLibrary: makeMockLibrary() });
  await app.ready();

  section('1 · List assets');
  {
    const res = await app.inject({ method: 'GET', url: '/assets' });
    assert(res.statusCode === 200, 'GET /assets returns 200');
    const body = res.json() as { assets: AssetListItem[]; total: number };
    assert(body.total === 1, 'one asset returned');
    assert(body.assets[0]?.id === 'asset-smoke-1', 'asset id present');
    assert(body.assets[0]?.publisherCount === 1, 'publisher count present');
  }

  section('2 · Pagination and filters');
  {
    const res = await app.inject({
      method: 'GET',
      url: '/assets?status=ready&mimeType=image/jpeg&limit=10&offset=0',
    });
    assert(res.statusCode === 200, 'filtered list returns 200');
  }

  section('3 · Asset detail');
  {
    const res = await app.inject({ method: 'GET', url: '/assets/asset-smoke-1' });
    assert(res.statusCode === 200, 'GET /assets/:id returns 200');
    const body = res.json() as AssetDetail;
    assert(body.processingTimeline.length === 1, 'processing timeline included');
    assert(body.publishingHistory.length === 1, 'publishing history included');
    assert(body.downloadUrl?.includes('/download'), 'download URL included');
  }

  section('4 · Missing asset');
  {
    const res = await app.inject({ method: 'GET', url: '/assets/missing' });
    assert(res.statusCode === 404, 'missing asset returns 404');
  }

  section('5 · Library unavailable');
  {
    const offline = buildApp({ config: baseConfig });
    await offline.ready();
    const res = await offline.inject({ method: 'GET', url: '/assets' });
    assert(res.statusCode === 503, '503 when library not configured');
    await offline.close();
  }

  await app.close();
  console.log('\n✅  All asset library API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
