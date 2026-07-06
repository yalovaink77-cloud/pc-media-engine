/**
 * Sprint 41 — Multi-Publisher Publish Workflow API smoke (offline).
 *
 * Exercises POST /composer/publish with in-process mocks — no Redis or network.
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
  version: '0.41.0-smoke',
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

const assetDetail: AssetDetail = {
  id: 'asset-smoke-1',
  projectId: 'proj-smoke',
  filename: 'smoke.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 4096,
  status: 'ready',
  originalFilename: 'smoke.jpg',
  storageKey: 'proj/smoke.jpg',
  storageProvider: 'local',
  dimensions: { width: 800, height: 600 },
  thumbnail: { url: '/assets/asset-smoke-1/thumbnail' },
  tags: ['smoke'],
  processingTimeline: [],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  metadata: {},
  publisherCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

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

function makeAssetLibrary(): AssetLibraryService {
  return {
    listAssets: async () => ({
      assets: [assetDetail],
      total: 1,
      limit: 50,
      offset: 0,
    }),
    getAsset: async (_p, id) => (id === 'asset-smoke-1' ? assetDetail : null),
    getAssetStorageKey: async () => 'proj/smoke.jpg',
    getThumbnailStorageKey: async () => 'proj/smoke_thumb.webp',
  };
}

type SmokeContext = {
  enqueued: Array<{ publisherId: string; payload: PublishingJobPayload }>;
  duplicates: Set<string>;
};

function makeSmokeStack(ctx: SmokeContext): {
  composerService: ReturnType<typeof createContentComposerService>;
  publishingEnqueuer: PublishingQueueEnqueuer;
} {
  let jobCounter = 0;
  const publishingEnqueuer: PublishingQueueEnqueuer = {
    enqueue: async (payload) => {
      const publisherId = payload.publisherId ?? 'mock';
      ctx.enqueued.push({ publisherId, payload });
      jobCounter += 1;
      return `job-${jobCounter}`;
    },
    close: async () => {},
  };

  const composerService = createContentComposerService({
    assetLibrary: makeAssetLibrary(),
    publisherService: makePublisherService(),
    publishingEnqueuer,
    storageProvider: {
      exists: async () => true,
      get: async () => Buffer.from('webp-thumb'),
    },
    defaultOrganizationId: 'org-smoke',
    findDuplicate: async (_projectId, publisher, slug) =>
      ctx.duplicates.has(`${publisher}:${slug}`),
    env: {
      WORDPRESS_URL: 'https://wp.smoke.test',
      GHOST_URL: 'https://ghost.smoke.test',
    },
  });

  return { composerService, publishingEnqueuer };
}

async function publish(
  app: ReturnType<typeof buildApp>,
  publisherIds: string[],
): Promise<{
  accepted: Array<{ publisherId: string; jobId: string }>;
  skipped: Array<{ publisherId: string; reason: string }>;
  failures: Array<{ publisherId: string; reason: string }>;
}> {
  const res = await app.inject({
    method: 'POST',
    url: '/composer/publish',
    payload: { assetId: 'asset-smoke-1', publisherIds },
  });
  assert(res.statusCode === 202, `publish returns 202 (got ${res.statusCode})`);
  return res.json() as {
    accepted: Array<{ publisherId: string; jobId: string }>;
    skipped: Array<{ publisherId: string; reason: string }>;
    failures: Array<{ publisherId: string; reason: string }>;
  };
}

async function main(): Promise<void> {
  const ctx: SmokeContext = { enqueued: [], duplicates: new Set() };
  const { composerService, publishingEnqueuer } = makeSmokeStack(ctx);
  const app = buildApp({ config: baseConfig, composerService, publishingEnqueuer });
  await app.ready();

  section('1 · Single publish');
  {
    const body = await publish(app, ['wordpress']);
    assert(body.accepted.length === 1, 'single publisher accepted');
    assert(body.accepted[0]?.publisherId === 'wordpress', 'wordpress job queued');
    assert(ctx.enqueued.length === 1, 'one job enqueued');
    assert(ctx.enqueued[0]?.publisherId === 'wordpress', 'payload has publisherId');
  }

  section('2 · Multi publish');
  {
    const before = ctx.enqueued.length;
    const body = await publish(app, ['wordpress', 'ghost']);
    assert(body.accepted.length === 2, 'both publishers accepted');
    assert(ctx.enqueued.length === before + 2, 'two independent jobs enqueued');
    const ids = ctx.enqueued.slice(before).map((j) => j.publisherId);
    assert(ids.includes('wordpress') && ids.includes('ghost'), 'fan-out to both publishers');
  }

  section('3 · Duplicate skip');
  {
    ctx.duplicates.add('wordpress:smoke');
    const body = await publish(app, ['wordpress']);
    assert(body.skipped.length === 1, 'duplicate skipped');
    assert(body.skipped[0]?.publisherId === 'wordpress', 'wordpress skipped');
    assert(body.accepted.length === 0, 'no new job for duplicate');
  }

  section('4 · Validation failure');
  {
    const body = await publish(app, ['unknown-publisher']);
    assert(body.failures.length === 1, 'unknown publisher fails validation');
    assert(body.accepted.length === 0, 'no job for invalid publisher');
  }

  section('5 · Mixed success');
  {
    ctx.duplicates.delete('wordpress:smoke');
    ctx.duplicates.add('ghost:smoke');
    const body = await publish(app, ['wordpress', 'ghost', 'unknown-publisher']);
    assert(
      body.accepted.some((a) => a.publisherId === 'wordpress'),
      'wordpress still queued',
    );
    assert(
      body.skipped.some((s) => s.publisherId === 'ghost'),
      'ghost skipped as duplicate',
    );
    assert(
      body.failures.some((f) => f.publisherId === 'unknown-publisher'),
      'unknown fails',
    );
  }

  section('6 · Queue unavailable');
  {
    const offline = buildApp({ config: baseConfig, composerService });
    await offline.ready();
    const res = await offline.inject({
      method: 'POST',
      url: '/composer/publish',
      payload: { assetId: 'asset-smoke-1', publisherIds: ['wordpress'] },
    });
    assert(res.statusCode === 503, '503 without enqueuer');
    await offline.close();
  }

  await app.close();
  console.log('\n✅  All publish workflow API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
