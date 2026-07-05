/**
 * Sprint 22 — Publishing history smoke.
 *
 * Verifies the full offline pipeline persists PublishedContent:
 *   Upload → Processing → Publishing → published_content row
 *
 * Usage: pnpm publishing-history:smoke
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
  ProcessingJobRepository,
  PublishedContentRepository,
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
  process.stderr.write(`\n✗ PUBLISHING HISTORY SMOKE FAILED: ${msg}\n`);
  process.exit(1);
}

line('\n═══ Sprint 22 Publishing History Smoke ═══\n');

async function main(): Promise<void> {
  let smokeStorageRoot = STORAGE_ROOT;
  let ownsTmpDir = false;

  if (!smokeStorageRoot) {
    smokeStorageRoot = await mkdtemp(resolve(tmpdir(), 'pcme-history-'));
    ownsTmpDir = true;
  }

  process.env['STORAGE_LOCAL_ROOT'] = smokeStorageRoot;

  const db = getPrismaClient();
  await db.$queryRaw`SELECT 1`;
  line('  ✓ Postgres reachable');

  const project = await db.project.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!project) fail('No project found — run pnpm db:seed first');

  process.env['PCME_DEFAULT_ORG_ID'] = process.env['PCME_DEFAULT_ORG_ID'] ?? project.organizationId;
  process.env['PCME_DEFAULT_PROJECT_ID'] = process.env['PCME_DEFAULT_PROJECT_ID'] ?? project.id;
  process.env['PCME_DEFAULT_PROJECT_SLUG'] =
    process.env['PCME_DEFAULT_PROJECT_SLUG'] ?? project.slug;

  const workerConfig = loadWorkerConfig();
  const processingWorker = startWorker(workerConfig);
  const publishingWorker = startPublishingWorker(workerConfig);
  await processingWorker.waitUntilReady();
  await publishingWorker.waitUntilReady();

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

  const apiConfig = loadConfig();
  const processingEnqueuer = buildProcessingEnqueuer(REDIS_URL, true);
  if (!processingEnqueuer) fail('Processing enqueuer not configured — set REDIS_URL');

  const app = buildApp({
    config: apiConfig,
    assetRepository: new MediaAssetRepository(),
    storageProvider: new LocalStorageProvider({ rootDir: resolve(smokeStorageRoot) }),
    jobScheduler: new ProcessingJobRepository(),
    processingEnqueuer,
  });

  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const baseUrl = address.startsWith('http') ? address : `http://${address}`;

  const jpeg = await sharp({
    create: { width: 240, height: 180, channels: 3, background: { r: 70, g: 130, b: 180 } },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  const boundary = `HistoryBoundary${randomUUID().replace(/-/g, '')}`;
  const filename = `history-${randomUUID().slice(0, 8)}.jpg`;
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

  if (!uploadRes.ok) fail(`POST /media failed: ${uploadRes.status}`);

  const uploadJson = (await uploadRes.json()) as {
    id: string;
    processingJobs: Array<{ id: string }>;
  };

  const processingJobId = uploadJson.processingJobs[0]!.id;
  const jobRepo = new ProcessingJobRepository();
  const historyRepo = new PublishedContentRepository();

  const processingDeadline = Date.now() + 60_000;
  let finalJob = await jobRepo.findByIdGlobal(processingJobId);
  while (finalJob && (finalJob.status === 'pending' || finalJob.status === 'running')) {
    if (Date.now() > processingDeadline) fail('Timeout waiting for processing job');
    await new Promise((r) => setTimeout(r, 500));
    finalJob = await jobRepo.findByIdGlobal(processingJobId);
  }

  if (!finalJob || finalJob.status !== 'completed') {
    fail(`Processing job did not complete: ${finalJob?.status ?? 'missing'}`);
  }

  const flowResult = await publishingResultPromise;
  if (!flowResult.success || !flowResult.post?.externalId) {
    fail('Publishing flow did not succeed');
  }

  const history = await historyRepo.findLatestByAsset(project.id, uploadJson.id);
  if (!history) fail('PublishedContent row not found');

  if (history.publisher !== 'mock') fail(`Expected publisher=mock, got ${history.publisher}`);
  if (history.externalId !== flowResult.post.externalId) {
    fail(`externalId mismatch: ${history.externalId} !== ${flowResult.post.externalId}`);
  }
  if (history.url !== flowResult.post.url) fail(`url mismatch: ${history.url}`);
  if (history.status !== 'draft') fail(`Expected status=draft, got ${history.status}`);
  if (!(history.publishedAt instanceof Date)) fail('publishedAt missing');

  line(`  ✓ PublishedContent saved — publisher=${history.publisher}`);
  line(`  ✓ externalId=${history.externalId}`);
  line(`  ✓ url=${history.url}`);
  line(`  ✓ status=${history.status}`);
  line(`  ✓ publishedAt=${history.publishedAt.toISOString()}`);

  line(`
╔══════════════════════════════════════════════════════════════════════╗
║ ✅ Publishing History Smoke PASSED — Sprint 22 verified             ║
╚══════════════════════════════════════════════════════════════════════╝
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
  fail(err instanceof Error ? err.message : String(err));
});
