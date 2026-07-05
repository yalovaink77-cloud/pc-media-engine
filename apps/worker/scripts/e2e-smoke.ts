/**
 * Sprint 21 — End-to-end automation alpha smoke.
 *
 * Verifies the offline pipeline:
 *   POST /media → ProcessingJob → thumbnail worker → metadata enrichment
 *   → publishing queue → MockPublisher draft result
 *
 * Prerequisites:
 *   docker compose up -d
 *   pnpm db:migrate && pnpm db:seed
 *
 * Usage:
 *   pnpm e2e:smoke
 *
 * Env (from .env or inline):
 *   DATABASE_URL, REDIS_URL
 * Optional:
 *   STORAGE_LOCAL_ROOT (defaults to per-run tmp dir)
 *   PCME_DEFAULT_ORG_ID / PCME_DEFAULT_PROJECT_ID (resolved from DB when absent)
 */

import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../.env'), override: false });

process.env['PCME_AUTO_ENQUEUE_PROCESSING'] = 'true';
process.env['PCME_AUTO_ENQUEUE_PUBLISHING'] = 'true';
process.env['AI_METADATA_PROVIDER'] = process.env['AI_METADATA_PROVIDER'] ?? 'none';
process.env['PUBLISHER_DRIVER'] = 'mock';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';

import { buildApp, buildProcessingEnqueuer, loadConfig } from '@pcme/api/public';
import {
  getPrismaClient,
  MediaAssetRepository,
  ProcessingArtifactRepository,
  ProcessingJobRepository,
} from '@pcme/database';
import { LocalStorageProvider } from '@pcme/media';
import type { PublishingFlowResult } from '@pcme/publishing';
import { Queue, QueueEvents } from 'bullmq';
import sharp from 'sharp';

import { loadWorkerConfig, parseRedisConnection } from '../src/config.js';
import { startPublishingWorker } from '../src/publishing-worker.js';
import { PROCESSING_QUEUE, PUBLISHING_QUEUE } from '../src/queue/names.js';
import { startWorker } from '../src/worker.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const STORAGE_ROOT = process.env['STORAGE_LOCAL_ROOT'] ?? '';
const connection = parseRedisConnection(REDIS_URL);

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`\n✗ E2E SMOKE FAILED: ${msg}\n`);
  process.exit(1);
}

line('\n═══ Sprint 21 E2E Smoke (upload → publish-ready draft) ═══\n');
line(`  AI_METADATA_PROVIDER = ${process.env['AI_METADATA_PROVIDER']}`);
line(`  PUBLISHER_DRIVER     = ${process.env['PUBLISHER_DRIVER']}`);

async function main(): Promise<void> {
  let smokeStorageRoot = STORAGE_ROOT;
  let ownsTmpDir = false;

  if (!smokeStorageRoot) {
    smokeStorageRoot = await mkdtemp(resolve(tmpdir(), 'pcme-e2e-'));
    ownsTmpDir = true;
    line(`  ℹ STORAGE_LOCAL_ROOT not set — using tmp dir: ${smokeStorageRoot}`);
  }

  process.env['STORAGE_LOCAL_ROOT'] = smokeStorageRoot;

  line('\n▶ Step 1 — Connecting to database...');
  const db = getPrismaClient();
  await db.$queryRaw`SELECT 1`;
  line('  ✓ Postgres reachable');

  const project = await db.project.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!project) fail('No project found — run pnpm db:seed first');

  process.env['PCME_DEFAULT_ORG_ID'] = process.env['PCME_DEFAULT_ORG_ID'] ?? project.organizationId;
  process.env['PCME_DEFAULT_PROJECT_ID'] = process.env['PCME_DEFAULT_PROJECT_ID'] ?? project.id;
  process.env['PCME_DEFAULT_PROJECT_SLUG'] =
    process.env['PCME_DEFAULT_PROJECT_SLUG'] ?? project.slug;

  line(`  ✓ project=${project.slug}`);

  line('\n▶ Step 2 — Starting processing + publishing workers...');
  const workerConfig = loadWorkerConfig();
  const processingWorker = startWorker(workerConfig);
  const publishingWorker = startPublishingWorker(workerConfig);
  await processingWorker.waitUntilReady();
  await publishingWorker.waitUntilReady();
  line('  ✓ Workers ready (auto enqueue publishing enabled)');

  for (const queueName of [PROCESSING_QUEUE, PUBLISHING_QUEUE] as const) {
    const drain = new Queue(queueName, { connection });
    await drain.obliterate({ force: true });
    await drain.close();
  }

  const publishingEvents = new QueueEvents(PUBLISHING_QUEUE, { connection });
  await publishingEvents.waitUntilReady();

  const publishingResultPromise = new Promise<PublishingFlowResult>((resolvePromise, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timeout: publishing worker did not complete in 60s')),
      60_000,
    );

    publishingEvents.on('completed', ({ returnvalue }) => {
      clearTimeout(timer);
      const parsed =
        typeof returnvalue === 'string'
          ? (JSON.parse(returnvalue) as PublishingFlowResult)
          : (returnvalue as PublishingFlowResult);
      resolvePromise(parsed);
    });

    publishingEvents.on('failed', ({ failedReason }) => {
      clearTimeout(timer);
      reject(new Error(`Publishing job failed: ${failedReason}`));
    });
  });

  line('\n▶ Step 3 — Starting API with auto processing enqueue...');
  const apiConfig = loadConfig();
  const assetRepository = new MediaAssetRepository();
  const jobScheduler = new ProcessingJobRepository();
  const storageProvider = new LocalStorageProvider({ rootDir: resolve(smokeStorageRoot) });
  const processingEnqueuer = buildProcessingEnqueuer(REDIS_URL, true);

  if (!processingEnqueuer) fail('Processing enqueuer not configured — set REDIS_URL');

  const app = buildApp({
    config: apiConfig,
    assetRepository,
    storageProvider,
    jobScheduler,
    processingEnqueuer,
  });

  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const baseUrl = address.startsWith('http') ? address : `http://${address}`;
  line(`  ✓ API listening at ${baseUrl}`);

  line('\n▶ Step 4 — Uploading test image via POST /media...');
  const jpeg = await sharp({
    create: { width: 240, height: 180, channels: 3, background: { r: 70, g: 130, b: 180 } },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  const boundary = `E2EBoundary${randomUUID().replace(/-/g, '')}`;
  const filename = `e2e-${randomUUID().slice(0, 8)}.jpg`;
  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`,
    ),
    jpeg,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${baseUrl}/media`, {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body: multipartBody,
  });

  if (!uploadRes.ok) fail(`POST /media failed: ${uploadRes.status} ${await uploadRes.text()}`);

  const uploadJson = (await uploadRes.json()) as {
    id: string;
    processingJobs: Array<{ id: string; processingType: string; status: string }>;
  };

  if (uploadJson.processingJobs.length !== 1) {
    fail(`Expected 1 processing job, got ${uploadJson.processingJobs.length}`);
  }

  const processingJobId = uploadJson.processingJobs[0]!.id;
  line(`  ✓ Upload OK — asset=${uploadJson.id}, processingJob=${processingJobId}`);

  line('\n▶ Step 5 — Waiting for processing job to complete...');
  const jobRepo = new ProcessingJobRepository();
  const artifactRepo = new ProcessingArtifactRepository();

  const processingDeadline = Date.now() + 60_000;
  let finalJob = await jobRepo.findByIdGlobal(processingJobId);

  while (finalJob && (finalJob.status === 'pending' || finalJob.status === 'running')) {
    if (Date.now() > processingDeadline) fail('Timeout waiting for processing job');
    await new Promise((r) => setTimeout(r, 500));
    finalJob = await jobRepo.findByIdGlobal(processingJobId);
  }

  if (!finalJob || finalJob.status !== 'completed') {
    fail(`Processing job did not complete: status=${finalJob?.status ?? 'missing'}`);
  }
  line(`  ✓ ProcessingJob status = ${finalJob.status}`);

  const artifacts = await artifactRepo.listByJob(finalJob.projectId, finalJob.id);
  if (artifacts.length === 0) fail('No ProcessingArtifact created');
  line(`  ✓ ProcessingArtifact created (${artifacts[0]!.mimeType})`);

  line('\n▶ Step 6 — Waiting for publishing worker (MockPublisher)...');

  const flowResult = await publishingResultPromise;

  if (!flowResult.success) fail('Publishing flow did not succeed');
  if (!flowResult.media?.externalId?.startsWith('media-')) {
    fail(`Unexpected media result: ${flowResult.media?.externalId}`);
  }
  if (!flowResult.post?.externalId?.startsWith('post-')) {
    fail(`Unexpected post result: ${flowResult.post?.externalId}`);
  }

  line(`  ✓ MockPublisher media=${flowResult.media.externalId}`);
  line(`  ✓ MockPublisher post=${flowResult.post.externalId}`);

  line(`
╔══════════════════════════════════════════════════════════════════════╗
║ ✅ E2E SMOKE PASSED — Sprint 21 offline automation alpha verified   ║
╚══════════════════════════════════════════════════════════════════════╝

Upload        POST /media → asset ${uploadJson.id}
Processing    job ${processingJobId} → thumbnail artifact
Publishing    MockPublisher draft (no external network)
`);

  await app.close();
  await processingWorker.close();
  await publishingWorker.close();
  await publishingEvents.close();
  await db.$disconnect();

  if (ownsTmpDir) {
    await rm(smokeStorageRoot, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
});
