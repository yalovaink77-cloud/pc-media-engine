/**
 * Worker smoke script — Sprint 11.
 *
 * Prerequisites:
 *   docker compose up -d     # starts Postgres + Redis
 *   pnpm --filter @pcme/database db:migrate
 *   pnpm --filter @pcme/database db:seed
 *
 * Usage:
 *   pnpm --filter @pcme/worker smoke
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env'), override: false });

import {
  getPrismaClient,
  ProcessingJobAttemptRepository,
  ProcessingJobRepository,
} from '@pcme/database';
import { Queue, QueueEvents, Worker } from 'bullmq';

import { parseRedisConnection } from '../config.js';
import { noopProcessor } from '../processors/noop.processor.js';
import { PROCESSING_QUEUE } from '../queue/names.js';
import type { ProcessingJobPayload } from '../queue/payload.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const DEFAULT_PROJECT_ID = process.env['PCME_DEFAULT_PROJECT_ID'] ?? '';
const connection = parseRedisConnection(REDIS_URL);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

line('\n═══ Sprint 11 Worker Smoke ═══\n');

// 1. Connect to DB
line('▶ Step 1 — Connecting to database...');
const db = getPrismaClient();
await db.$queryRaw`SELECT 1`;
line('  ✓ Postgres reachable');

// 2. Find a pending ProcessingJob (from seeded data or create one)
line('\n▶ Step 2 — Resolving a pending ProcessingJob...');
const jobRepo = new ProcessingJobRepository();

let smokeJob = await db.processingJob.findFirst({
  where: { status: 'pending' },
  orderBy: { createdAt: 'asc' },
});

if (!smokeJob) {
  // Create a smoke job against the seeded asset
  const seededAsset = await db.asset.findFirst({
    where: { projectId: DEFAULT_PROJECT_ID || undefined },
    orderBy: { createdAt: 'asc' },
  });

  if (!seededAsset) {
    line('  ✗ No asset found — run db:seed first');
    process.exit(1);
  }

  smokeJob = await jobRepo.create({
    organizationId: seededAsset.organizationId,
    projectId: seededAsset.projectId,
    assetId: seededAsset.id,
    processingType: 'thumbnail',
  });
  line(`  ✓ Created smoke ProcessingJob (id=${smokeJob.id})`);
} else {
  line(`  ✓ Using existing pending job (id=${smokeJob.id}, type=${smokeJob.processingType})`);
}

// 3. Connect to Redis + set up queue
line('\n▶ Step 3 — Connecting to Redis...');
const queue = new Queue<ProcessingJobPayload>(PROCESSING_QUEUE, { connection });
const queueEvents = new QueueEvents(PROCESSING_QUEUE, { connection });

// Verify Redis is reachable before proceeding
await queue.waitUntilReady();
line('  ✓ Redis reachable');

// 4. Start in-process worker
line('\n▶ Step 4 — Starting in-process worker...');
const attemptRepo = new ProcessingJobAttemptRepository();

const worker = new Worker<ProcessingJobPayload>(
  PROCESSING_QUEUE,
  async (job) => {
    await noopProcessor(job.data.processingJobId, { jobRepo, attemptRepo });
  },
  { connection, concurrency: 1 },
);

await worker.waitUntilReady();
line('  ✓ Worker ready');

// 5. Enqueue the job
line('\n▶ Step 5 — Enqueueing processing job...');
const bullJob = await queue.add('process', { processingJobId: smokeJob.id });
line(`  ✓ Enqueued BullMQ job (id=${bullJob.id})`);

// 6. Wait for completion (30-second timeout)
line('\n▶ Step 6 — Waiting for worker to process...');
await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error('Timeout: worker did not complete in 30s')),
    30_000,
  );

  queueEvents.on('completed', ({ jobId }) => {
    if (jobId === bullJob.id) {
      clearTimeout(timer);
      resolve();
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

// 7. Verify DB state
line('\n▶ Step 7 — Verifying database state...');
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

// 8. Summary
line(`
╔══════════════════════════════════════════════════════════════════╗
║ ✅ Smoke PASSED — Sprint 11 queue + worker verified              ║
╚══════════════════════════════════════════════════════════════════╝

Queue: ${PROCESSING_QUEUE}
ProcessingJob ${finalJob.id}
  processingType = ${finalJob.processingType}
  status         = ${finalJob.status}
  └── Attempt ${lastAttempt.attemptNumber}: ${lastAttempt.status}
`);

// 9. Clean up
await worker.close();
await queueEvents.close();
await queue.close();
await db.$disconnect();
process.exit(0);
