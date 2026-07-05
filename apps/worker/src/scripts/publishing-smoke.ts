/**
 * Publishing worker smoke script — Sprint 17.
 *
 * Verifies the publishing queue + worker end-to-end:
 *   PublishingJobPayload → BullMQ → PublishingOrchestrator → MockPublisher
 *
 * Prerequisites:
 *   docker compose up -d   (Redis)
 *
 * Usage:
 *   pnpm --filter @pcme/worker publishing:smoke
 *
 * Required env vars (from .env):
 *   REDIS_URL
 *
 * No WordPress, no database, no external network calls.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env'), override: false });

import type { PublishingFlowResult } from '@pcme/publishing';
import { Queue, QueueEvents, Worker } from 'bullmq';

import { parseRedisConnection } from '../config.js';
import { processPublishingJob } from '../processors/publishing.processor.js';
import { PUBLISHING_QUEUE } from '../queue/names.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import { validatePublishingJobPayload } from '../queue/publishing-payload.js';

/** Always mock — ignores PUBLISHER_DRIVER in environment. */
const MOCK_DRIVER = { publisherDriver: 'mock' as const };

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const connection = parseRedisConnection(REDIS_URL);

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function section(title: string): void {
  process.stdout.write(`\n▶ ${title}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`\n✗ SMOKE FAILED: ${msg}\n`);
  process.exit(1);
}

line('\n═══ Sprint 17 Publishing Worker Smoke ═══\n');

// -------------------------------------------------------------------------
// Step 1 — Connect to Redis
// -------------------------------------------------------------------------
section('Step 1 — Connecting to Redis');

const queue = new Queue<PublishingJobPayload>(PUBLISHING_QUEUE, { connection });
const queueEvents = new QueueEvents(PUBLISHING_QUEUE, { connection });
await queue.waitUntilReady();
line('  ✓ Redis reachable');

// -------------------------------------------------------------------------
// Step 2 — Start in-process publishing worker
// -------------------------------------------------------------------------
section('Step 2 — Starting in-process publishing worker');

const worker = new Worker<PublishingJobPayload>(
  PUBLISHING_QUEUE,
  async (job) => {
    const payload = validatePublishingJobPayload(job.data);
    return processPublishingJob(payload, MOCK_DRIVER);
  },
  { connection, concurrency: 1 },
);
await worker.waitUntilReady();
line('  ✓ Publishing worker ready (MockPublisher only)');

// -------------------------------------------------------------------------
// Step 3 — Enqueue fake publishing payload
// -------------------------------------------------------------------------
section('Step 3 — Enqueueing publishing job');

const payload: PublishingJobPayload = {
  title: 'Industrial Aftercare Guide',
  slug: 'industrial-aftercare-guide',
  body: '<p>Clean twice daily with saline solution.</p>',
  mediaData: 'smoke-mock-image-bytes',
  mediaMimeType: 'image/jpeg',
  mediaFilename: 'industrial-aftercare.jpg',
};

const bullJob = await queue.add('publish', payload);
line(`  ✓ Enqueued BullMQ job (id=${bullJob.id})`);

// -------------------------------------------------------------------------
// Step 4 — Wait for completion
// -------------------------------------------------------------------------
section('Step 4 — Waiting for worker to process');

const flowResult = await new Promise<PublishingFlowResult>((resolvePromise, reject) => {
  const timer = setTimeout(
    () => reject(new Error('Timeout: publishing worker did not complete in 30s')),
    30_000,
  );

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    if (jobId === bullJob.id) {
      clearTimeout(timer);
      const parsed =
        typeof returnvalue === 'string'
          ? (JSON.parse(returnvalue) as PublishingFlowResult)
          : (returnvalue as PublishingFlowResult);
      resolvePromise(parsed);
    }
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    if (jobId === bullJob.id) {
      clearTimeout(timer);
      reject(new Error(`Job failed: ${failedReason}`));
    }
  });
});

line('  ✓ Worker completed');

// -------------------------------------------------------------------------
// Step 5 — Verify combined result
// -------------------------------------------------------------------------
section('Step 5 — Verifying combined publishing result');

if (!flowResult.success) fail(`Expected success=true, got ${flowResult.success}`);
line(`  ✓ success = ${flowResult.success}`);

if (!flowResult.media?.externalId) fail('Missing media.externalId');
line(`  ✓ media.externalId = ${flowResult.media.externalId}`);
line(`  ✓ media.url = ${flowResult.media.url}`);

if (!flowResult.post?.externalId) fail('Missing post.externalId');
line(`  ✓ post.externalId = ${flowResult.post.externalId}`);
line(`  ✓ post.url = ${flowResult.post.url}`);

if (!flowResult.media.externalId.startsWith('media-')) {
  fail(`Expected media id prefix media-, got ${flowResult.media.externalId}`);
}
if (!flowResult.post.externalId.startsWith('post-')) {
  fail(`Expected post id prefix post-, got ${flowResult.post.externalId}`);
}
line('  ✓ Result contains media + draft post from MockPublisher');

// -------------------------------------------------------------------------
// Done
// -------------------------------------------------------------------------
line(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅  Publishing Worker Smoke PASSED — Sprint 17                 ║
╚══════════════════════════════════════════════════════════════════╝

Queue:      ${PUBLISHING_QUEUE}
Publisher:  MockPublisher (no external network)
Flow:       enqueue → worker → orchestrator → media + draft
`);

await worker.close();
await queueEvents.close();
await queue.close();

process.exit(0);
