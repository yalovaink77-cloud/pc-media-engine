/**
 * Sprint 43 — Publishing Calendar API smoke (offline).
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { AssetDetail, AssetLibraryService } from '../src/assets/types.js';
import { createCalendarService } from '../src/calendar/calendar-service.js';
import { createContentComposerService } from '../src/composer/content-composer-service.js';
import type { PublisherManagementService } from '../src/publishers/types.js';
import type { JobDetail, JobListItem } from '../src/queue/job-types.js';
import type { PublishingQueueEnqueuer } from '../src/queue/publishing-enqueue.js';
import type { PublishingJobPayload } from '../src/queue/publishing-payload.js';
import type { QueueService } from '../src/queue/queue-service.js';

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
  version: '0.43.0-smoke',
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

const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
const past = '2020-01-01T00:00:00.000Z';

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
  id: 'asset-1',
  projectId: 'proj-smoke',
  filename: 'smoke.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 4096,
  status: 'ready',
  originalFilename: 'smoke.jpg',
  storageKey: 'proj/smoke.jpg',
  storageProvider: 'local',
  dimensions: { width: 800, height: 600 },
  thumbnail: { url: '/assets/asset-1/thumbnail' },
  tags: [],
  processingTimeline: [],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  metadata: {},
  publisherCount: 0,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:00:00.000Z',
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
        description: `${p.displayName}`,
        configurationRequirements:
          id === 'wordpress'
            ? [{ envVar: 'WORDPRESS_URL', required: true, description: 'URL' }]
            : [{ envVar: 'GHOST_URL', required: true, description: 'URL' }],
      };
    },
    checkHealth: async () => ({ healthy: true, latency: 5, message: 'ok' }),
  };
}

function makeMockQueue(jobs: JobListItem[]): QueueService {
  const detailFor = (job: JobListItem): JobDetail => ({
    ...job,
    payload: {
      title: job.title,
      slug: job.slug,
      scheduledFor: job.scheduledFor,
      hasMedia: true,
      assetId: job.assetId,
      projectId: job.projectId,
      publisherId: job.publisher,
    },
    queueState: job.status,
    scheduledTime: job.scheduledFor,
    retryHistory: [],
    queuePaused: false,
  });

  return {
    getStatus: async () => ({
      paused: false,
      waiting: 0,
      active: 0,
      delayed: 1,
      completed: 0,
      failed: 0,
    }),
    pause: async () => {},
    resume: async () => {},
    drain: async () => {},
    retryJob: async () => {},
    removeJob: async () => {},
    listJobs: async () => ({ jobs, total: jobs.length, limit: 2000, offset: 0 }),
    getJob: async (id) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) throw new Error('not found');
      return detailFor(job);
    },
  };
}

async function main(): Promise<void> {
  const scheduledJob: JobListItem = {
    id: 'job-scheduled-1',
    name: 'publish',
    status: 'delayed',
    publisher: 'wordpress',
    projectId: 'proj-smoke',
    assetId: 'asset-1',
    title: 'Smoke Post',
    slug: 'smoke',
    retryCount: 0,
    maxAttempts: 4,
    createdAt: new Date().toISOString(),
    scheduledFor: future,
  };

  let enqueued: PublishingJobPayload[] = [];
  const publishingEnqueuer: PublishingQueueEnqueuer = {
    enqueue: async (payload) => {
      enqueued.push(payload);
      return `job-${enqueued.length}`;
    },
    close: async () => {},
  };

  const composerService = createContentComposerService({
    assetLibrary: {
      listAssets: async () => ({ assets: [assetDetail], total: 1, limit: 50, offset: 0 }),
      getAsset: async (_p, id) => (id === 'asset-1' ? assetDetail : null),
      getAssetStorageKey: async () => 'proj/smoke.jpg',
      getThumbnailStorageKey: async () => 'proj/smoke_thumb.webp',
    } satisfies AssetLibraryService,
    publisherService: makePublisherService(),
    publishingEnqueuer,
    storageProvider: { exists: async () => true, get: async () => Buffer.from('thumb') },
    findDuplicate: async (_p, publisher) => publisher === 'ghost',
    env: { WORDPRESS_URL: 'https://wp.test', GHOST_URL: 'https://ghost.test' },
  });

  const calendarService = createCalendarService({
    queueService: makeMockQueue([scheduledJob]),
    publishedContentRepo: { findHistory: async () => [], findById: async () => null },
  });

  const app = buildApp({
    config: baseConfig,
    composerService,
    publishingEnqueuer,
    calendarService,
  });
  await app.ready();

  section('1 · Single schedule');
  {
    enqueued = [];
    const res = await app.inject({
      method: 'POST',
      url: '/composer/schedule',
      payload: { assetId: 'asset-1', publisherIds: ['wordpress'], scheduledFor: future },
    });
    assert(res.statusCode === 202, 'schedule returns 202');
    assert(enqueued.length === 1, 'one delayed job');
    assert(enqueued[0]?.scheduledFor === future, 'scheduledFor on payload');
  }

  section('2 · Multi publisher schedule');
  {
    enqueued = [];
    const res = await app.inject({
      method: 'POST',
      url: '/composer/schedule',
      payload: { assetId: 'asset-1', publisherIds: ['wordpress', 'ghost'], scheduledFor: future },
    });
    const body = res.json() as { accepted: unknown[]; skipped: unknown[] };
    assert(body.accepted.length === 1, 'wordpress accepted');
    assert(body.skipped.length === 1, 'ghost duplicate skipped');
    assert(enqueued.length === 1, 'one enqueue for non-duplicate');
  }

  section('3 · Calendar events');
  {
    const res = await app.inject({
      method: 'GET',
      url: `/calendar/events?start=2026-01-01T00:00:00.000Z&end=2030-01-01T00:00:00.000Z`,
    });
    assert(res.statusCode === 200, 'events 200');
    const body = res.json() as { count: number };
    assert(body.count >= 1, 'scheduled event listed');
  }

  section('4 · Timeline ordering');
  {
    const res = await app.inject({ method: 'GET', url: '/calendar/timeline' });
    const body = res.json() as { entries: Array<{ timestamp: string }> };
    assert(body.entries.length >= 1, 'timeline has entries');
    if (body.entries.length >= 2) {
      assert(body.entries[0]!.timestamp <= body.entries[1]!.timestamp, 'chronological order');
    }
  }

  section('5 · Invalid schedule');
  {
    const res = await app.inject({
      method: 'POST',
      url: '/composer/schedule',
      payload: { assetId: 'asset-1', publisherIds: ['wordpress'], scheduledFor: past },
    });
    const body = res.json() as { failures: Array<{ reason: string }> };
    assert(body.failures[0]?.reason.includes('future'), 'past schedule rejected');
  }

  section('6 · Duplicate schedule');
  {
    const res = await app.inject({
      method: 'POST',
      url: '/composer/schedule',
      payload: { assetId: 'asset-1', publisherIds: ['ghost'], scheduledFor: future },
    });
    const body = res.json() as { skipped: unknown[] };
    assert(body.skipped.length === 1, 'duplicate skipped at schedule time');
  }

  await app.close();
  console.log('\n✅  All publishing calendar API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
