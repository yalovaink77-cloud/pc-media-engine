/**
 * Sprint 42 — Bulk Publishing API smoke (offline).
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { AssetDetail, AssetLibraryService } from '../src/assets/types.js';
import { createContentComposerService } from '../src/composer/content-composer-service.js';
import type { PublisherManagementService } from '../src/publishers/types.js';
import type { PublishingQueueEnqueuer } from '../src/queue/publishing-enqueue.js';
import type { PublishingJobPayload } from '../src/queue/publishing-payload.js';

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

const NOW = '2024-06-01T10:00:00.000Z';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.42.0-smoke',
  databaseUrl: 'postgres://test',
  storageLocalRoot: '/tmp/storage',
  defaultOrgId: 'org-smoke',
  defaultProjectId: 'proj-smoke',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: 'redis://127.0.0.1:6379',
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const capabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: true,
  featuredImages: true,
  scheduling: false,
  update: false,
  delete: false,
};

function makeAsset(id: string, slug: string): AssetDetail {
  return {
    id,
    projectId: 'proj-smoke',
    filename: `${slug}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 4096,
    status: 'ready',
    originalFilename: `${slug}.jpg`,
    storageKey: `proj/${slug}.jpg`,
    storageProvider: 'local',
    dimensions: { width: 800, height: 600 },
    thumbnail: { url: `/assets/${id}/thumbnail` },
    tags: ['smoke'],
    processingTimeline: [],
    publishingHistory: [],
    publishingSummary: { total: 0, publishers: [] },
    metadata: {},
    publisherCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const assets = [
  makeAsset('asset-1', 'alpha'),
  makeAsset('asset-2', 'beta'),
  makeAsset('asset-3', 'gamma'),
];

function makePublisherService(): PublisherManagementService {
  const publishers = [
    {
      id: 'wordpress',
      displayName: 'WordPress',
      version: '1.0.0',
      enabled: true,
      capabilities,
      supportsHealthCheck: true,
    },
    {
      id: 'ghost',
      displayName: 'Ghost',
      version: '1.0.0',
      enabled: true,
      capabilities,
      supportsHealthCheck: true,
    },
  ];
  return {
    listPublishers: () => publishers,
    getPublisher: (id) => {
      const p = publishers.find((x) => x.id === id);
      if (!p) return null;
      return {
        ...p,
        description: `${p.displayName} publisher`,
        configurationRequirements:
          id === 'wordpress'
            ? [{ envVar: 'WORDPRESS_URL', required: true, description: 'Site URL' }]
            : [{ envVar: 'GHOST_URL', required: true, description: 'Site URL' }],
      };
    },
    checkHealth: async () => ({ healthy: true, latency: 5, message: 'ok' }),
  };
}

type SmokeContext = {
  enqueued: PublishingJobPayload[];
  duplicates: Set<string>;
};

function makeSmokeStack(ctx: SmokeContext): {
  composerService: ReturnType<typeof createContentComposerService>;
  publishingEnqueuer: PublishingQueueEnqueuer;
} {
  let jobCounter = 0;
  const publishingEnqueuer: PublishingQueueEnqueuer = {
    enqueue: async (payload) => {
      ctx.enqueued.push(payload);
      jobCounter += 1;
      return `job-${jobCounter}`;
    },
    close: async () => {},
  };

  const composerService = createContentComposerService({
    assetLibrary: {
      listAssets: async () => ({ assets, total: assets.length, limit: 50, offset: 0 }),
      getAsset: async (_p, id) => assets.find((a) => a.id === id) ?? null,
      getAssetStorageKey: async () => 'proj/smoke.jpg',
      getThumbnailStorageKey: async () => 'proj/smoke_thumb.webp',
    } satisfies AssetLibraryService,
    publisherService: makePublisherService(),
    publishingEnqueuer,
    storageProvider: { exists: async () => true, get: async () => Buffer.from('webp-thumb') },
    defaultOrganizationId: 'org-smoke',
    findDuplicate: async (_projectId, publisher, slug) =>
      ctx.duplicates.has(`${publisher}:${slug}`),
    env: { WORDPRESS_URL: 'https://wp.smoke.test', GHOST_URL: 'https://ghost.smoke.test' },
  });

  return { composerService, publishingEnqueuer };
}

async function bulk(app: ReturnType<typeof buildApp>, assetIds: string[], publisherIds: string[]) {
  const res = await app.inject({
    method: 'POST',
    url: '/composer/bulk-publish',
    payload: { assetIds, publisherIds },
  });
  assert(res.statusCode === 202, `bulk publish returns 202 (got ${res.statusCode})`);
  return res.json() as {
    accepted: Array<{ assetId: string; publisherId: string; jobId: string }>;
    skipped: Array<{ assetId: string; publisherId: string; reason: string }>;
    failures: Array<{ assetId: string; publisherId: string; reason: string }>;
    summary: { accepted: number; skipped: number; failures: number; pairs: number };
  };
}

async function main(): Promise<void> {
  const ctx: SmokeContext = { enqueued: [], duplicates: new Set() };
  const { composerService, publishingEnqueuer } = makeSmokeStack(ctx);
  const app = buildApp({ config: baseConfig, composerService, publishingEnqueuer });
  await app.ready();

  section('1 · Single asset');
  {
    const body = await bulk(app, ['asset-1'], ['wordpress']);
    assert(body.summary.accepted === 1, 'one job queued');
    assert(ctx.enqueued.length === 1, 'one enqueue');
  }

  section('2 · Multiple assets');
  {
    const before = ctx.enqueued.length;
    const body = await bulk(app, ['asset-1', 'asset-2'], ['wordpress']);
    assert(body.summary.accepted === 2, 'two jobs for two assets');
    assert(ctx.enqueued.length === before + 2, 'independent jobs per asset');
  }

  section('3 · Multiple publishers');
  {
    const before = ctx.enqueued.length;
    const body = await bulk(app, ['asset-3'], ['wordpress', 'ghost']);
    assert(body.summary.accepted === 2, 'fan-out to two publishers');
    assert(ctx.enqueued.length === before + 2, 'two publisher jobs');
  }

  section('4 · Mixed validation');
  {
    const body = await bulk(app, ['asset-1', 'missing'], ['wordpress', 'unknown-publisher']);
    assert(body.summary.failures > 0, 'validation failures recorded');
    assert(body.summary.accepted >= 1, 'valid pairs still queued');
  }

  section('5 · Duplicate handling');
  {
    ctx.duplicates.add('wordpress:alpha');
    const body = await bulk(app, ['asset-1'], ['wordpress', 'ghost']);
    assert(
      body.skipped.some((s) => s.publisherId === 'wordpress'),
      'wordpress duplicate skipped',
    );
    assert(
      body.accepted.some((a) => a.publisherId === 'ghost'),
      'ghost still accepted',
    );
  }

  section('6 · Large batch');
  {
    const largeAssets = Array.from({ length: 20 }, (_, i) => `asset-bulk-${i + 1}`);
    const stack = makeSmokeStack({ enqueued: [], duplicates: new Set() });
    const largeService = createContentComposerService({
      assetLibrary: {
        listAssets: async () => ({ assets: [], total: 0, limit: 50, offset: 0 }),
        getAsset: async (_p, id) => (largeAssets.includes(id) ? makeAsset(id, `bulk-${id}`) : null),
        getAssetStorageKey: async () => 'proj/bulk.jpg',
        getThumbnailStorageKey: async () => 'proj/bulk_thumb.webp',
      },
      publisherService: makePublisherService(),
      publishingEnqueuer: stack.publishingEnqueuer,
      storageProvider: { exists: async () => true, get: async () => Buffer.from('thumb') },
      env: { WORDPRESS_URL: 'https://wp.smoke.test' },
    });
    const largeApp = buildApp({
      config: baseConfig,
      composerService: largeService,
      publishingEnqueuer: stack.publishingEnqueuer,
    });
    await largeApp.ready();
    const body = await bulk(largeApp, largeAssets, ['wordpress']);
    assert(body.summary.accepted === 20, '20 jobs for large batch');
    assert(body.summary.pairs === 20, 'pair count matches');
    await largeApp.close();
  }

  await app.close();
  console.log('\n✅  All bulk publishing API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
