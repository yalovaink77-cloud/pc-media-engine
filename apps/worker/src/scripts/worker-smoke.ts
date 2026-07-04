/**
 * Worker smoke script — Sprint 12 (thumbnail generation).
 *
 * Idempotent: creates a fresh Asset + ProcessingJob on every run so the
 * @@unique([assetId, processingType]) constraint is never violated.
 * Seeded records are never mutated.
 *
 * Prerequisites:
 *   docker compose up -d
 *   pnpm --filter @pcme/database db:migrate
 *   pnpm --filter @pcme/database db:seed
 *
 * Usage:
 *   pnpm --filter @pcme/worker smoke
 *
 * Required env vars (from .env):
 *   DATABASE_URL, REDIS_URL
 * Optional:
 *   STORAGE_LOCAL_ROOT  (defaults to a per-run tmp directory)
 */

import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env'), override: false });

import {
  getPrismaClient,
  MediaAssetRepository,
  ProcessingArtifactRepository,
  ProcessingJobAttemptRepository,
  ProcessingJobRepository,
} from '@pcme/database';
import { LocalStorageProvider } from '@pcme/media';
import { Queue, QueueEvents, Worker } from 'bullmq';
import sharp from 'sharp';

import { parseRedisConnection } from '../config.js';
import { dispatchJob } from '../processors/dispatch.js';
import { PROCESSING_QUEUE } from '../queue/names.js';
import type { ProcessingJobPayload } from '../queue/payload.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const STORAGE_ROOT = process.env['STORAGE_LOCAL_ROOT'] ?? '';
const connection = parseRedisConnection(REDIS_URL);

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

line('\n═══ Sprint 12 Worker Smoke (thumbnail generation) ═══\n');

// --- Storage root -----------------------------------------------------------
let smokeStorageRoot = STORAGE_ROOT;
let ownsTmpDir = false;

if (!smokeStorageRoot) {
  smokeStorageRoot = await mkdtemp(resolve(tmpdir(), 'pcme-smoke-'));
  ownsTmpDir = true;
  line(`  ℹ STORAGE_LOCAL_ROOT not set — using tmp dir: ${smokeStorageRoot}`);
}

const storageProvider = new LocalStorageProvider({ rootDir: smokeStorageRoot });

// --- DB connection ----------------------------------------------------------
line('▶ Step 1 — Connecting to database...');
const db = getPrismaClient();
await db.$queryRaw`SELECT 1`;
line('  ✓ Postgres reachable');

// --- Resolve seeded org + project -------------------------------------------
line('\n▶ Step 2 — Resolving seeded org / project...');
const project = await db.project.findFirst({ orderBy: { createdAt: 'asc' } });
if (!project) {
  line('  ✗ No project found — run db:seed first');
  process.exit(1);
}
line(`  ✓ project=${project.slug} (id=${project.id})`);

const jobRepo = new ProcessingJobRepository();
const assetRepo = new MediaAssetRepository();
const attemptRepo = new ProcessingJobAttemptRepository();
const artifactRepo = new ProcessingArtifactRepository();

// --- Create a fresh smoke asset per run ------------------------------------
// Using a unique assetId each time guarantees the @@unique([assetId, processingType])
// constraint is never violated, regardless of previous smoke runs or seeded data.
line('\n▶ Step 3 — Creating fresh smoke asset...');
const smokeId = randomUUID().replace(/-/g, '');
const smokeFilename = `smoke-${smokeId.slice(0, 8)}.jpg`;
const smokeStorageKey = `${project.slug}/${smokeId}/${smokeFilename}`;

const smokeAsset = await assetRepo.create({
  id: smokeId,
  organizationId: project.organizationId,
  projectId: project.id,
  filename: smokeFilename,
  originalFilename: smokeFilename,
  mimeType: 'image/jpeg',
  storageProvider: 'local',
  storageKey: smokeStorageKey,
  sizeBytes: 0,
});
line(`  ✓ Asset created (id=${smokeAsset.id})`);
line(`    storageKey = ${smokeStorageKey}`);

// --- Write test JPEG to storage ---------------------------------------------
line('\n▶ Step 4 — Writing source image to storage...');
const testJpeg = await sharp({
  create: { width: 200, height: 150, channels: 3, background: { r: 100, g: 149, b: 237 } },
})
  .jpeg({ quality: 80 })
  .toBuffer();

await storageProvider.put(smokeStorageKey, testJpeg, 'image/jpeg');
line(`  ✓ Source JPEG written (${testJpeg.length} bytes)`);

// --- Create ProcessingJob for the fresh asset ------------------------------
line('\n▶ Step 5 — Creating pending ProcessingJob...');
const smokeJob = await jobRepo.create({
  organizationId: project.organizationId,
  projectId: project.id,
  assetId: smokeAsset.id,
  processingType: 'thumbnail',
});
line(`  ✓ ProcessingJob created (id=${smokeJob.id}, status=${smokeJob.status})`);

// --- Redis connection -------------------------------------------------------
line('\n▶ Step 6 — Connecting to Redis...');
const queue = new Queue<ProcessingJobPayload>(PROCESSING_QUEUE, { connection });
const queueEvents = new QueueEvents(PROCESSING_QUEUE, { connection });
await queue.waitUntilReady();
line('  ✓ Redis reachable');

// --- Start in-process worker -----------------------------------------------
line('\n▶ Step 7 — Starting in-process worker...');
const worker = new Worker<ProcessingJobPayload>(
  PROCESSING_QUEUE,
  async (job) => {
    await dispatchJob(job.data.processingJobId, {
      jobRepo,
      attemptRepo,
      assetRepo,
      storageProvider,
      artifactRepo,
    });
  },
  { connection, concurrency: 1 },
);
await worker.waitUntilReady();
line('  ✓ Worker ready');

// --- Enqueue the job -------------------------------------------------------
line('\n▶ Step 8 — Enqueueing processing job...');
const bullJob = await queue.add('process', { processingJobId: smokeJob.id });
line(`  ✓ Enqueued BullMQ job (id=${bullJob.id})`);

// --- Wait for completion ---------------------------------------------------
line('\n▶ Step 9 — Waiting for worker to process...');
await new Promise<void>((res, rej) => {
  const timer = setTimeout(() => rej(new Error('Timeout: worker did not complete in 30s')), 30_000);

  queueEvents.on('completed', ({ jobId }) => {
    if (jobId === bullJob.id) {
      clearTimeout(timer);
      res();
    }
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    if (jobId === bullJob.id) {
      clearTimeout(timer);
      rej(new Error(`Job failed: ${failedReason}`));
    }
  });
});
line('  ✓ Worker completed');

// --- Verify DB state -------------------------------------------------------
line('\n▶ Step 10 — Verifying database state...');

const finalJob = await jobRepo.findByIdGlobal(smokeJob.id);
if (!finalJob) throw new Error('ProcessingJob disappeared from DB');
if (finalJob.status !== 'completed') {
  throw new Error(`Expected job status=completed, got status=${finalJob.status}`);
}
line(`  ✓ ProcessingJob status = ${finalJob.status}`);

const attempts = await attemptRepo.listByJob(finalJob.projectId, finalJob.id);
if (attempts.length === 0) throw new Error('No ProcessingJobAttempt found');
const lastAttempt = attempts[attempts.length - 1]!;
if (lastAttempt.status !== 'completed') {
  throw new Error(`Expected attempt status=completed, got status=${lastAttempt.status}`);
}
line(
  `  ✓ ProcessingJobAttempt (number=${lastAttempt.attemptNumber}) status = ${lastAttempt.status}`,
);

const artifacts = await artifactRepo.listByJob(finalJob.projectId, finalJob.id);
if (artifacts.length === 0) throw new Error('No ProcessingArtifact found');
const artifact = artifacts[0]!;
if (artifact.mimeType !== 'image/webp') {
  throw new Error(`Expected mimeType=image/webp, got ${artifact.mimeType}`);
}
line(`  ✓ ProcessingArtifact created (mimeType=${artifact.mimeType})`);
line(`    storageKey = ${artifact.storageKey ?? '(null)'}`);

// --- Verify thumbnail file in storage -------------------------------------
if (artifact.storageKey) {
  const thumbExists = await storageProvider.exists(artifact.storageKey);
  if (!thumbExists) {
    throw new Error(`Thumbnail file not found in storage: ${artifact.storageKey}`);
  }
  const thumbMeta = await storageProvider.stat(artifact.storageKey);
  line(`  ✓ Thumbnail file exists (${thumbMeta.sizeBytes} bytes)`);

  const thumbBuffer = await storageProvider.get(artifact.storageKey);
  const metadata = await sharp(thumbBuffer).metadata();
  if (metadata.format !== 'webp') {
    throw new Error(`Expected thumbnail format=webp, got format=${metadata.format}`);
  }
  if ((metadata.width ?? 0) > 512) {
    throw new Error(`Expected thumbnail width <= 512, got ${metadata.width}`);
  }
  line(`  ✓ Thumbnail is valid WEBP (${metadata.width}×${metadata.height})`);
}

// --- Summary ---------------------------------------------------------------
line(`
╔════════════════════════════════════════════════════════════════════╗
║ ✅ Smoke PASSED — Sprint 12 thumbnail generation verified          ║
╚════════════════════════════════════════════════════════════════════╝

Queue:  ${PROCESSING_QUEUE}
Asset   ${smokeAsset.id}
  storageKey = ${smokeStorageKey}
ProcessingJob ${finalJob.id}
  processingType = ${finalJob.processingType}
  status         = ${finalJob.status}
  └── Attempt ${lastAttempt.attemptNumber}: ${lastAttempt.status}
ProcessingArtifact ${artifact.id}
  mimeType   = ${artifact.mimeType}
  storageKey = ${artifact.storageKey ?? '(null)'}
`);

// --- Clean up --------------------------------------------------------------
await worker.close();
await queueEvents.close();
await queue.close();
await db.$disconnect();

if (ownsTmpDir) {
  await rm(smokeStorageRoot, { recursive: true, force: true });
}

process.exit(0);
