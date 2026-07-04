import { ProcessingJobAttemptRepository, ProcessingJobRepository } from '@pcme/database';
import { Worker } from 'bullmq';

import type { WorkerConfig } from './config.js';
import { parseRedisConnection } from './config.js';
import { noopProcessor } from './processors/noop.processor.js';
import { PROCESSING_QUEUE } from './queue/names.js';
import { validateJobPayload } from './queue/payload.js';

/**
 * Create and start a BullMQ Worker connected to the `processing` queue.
 *
 * The worker:
 *   - Validates the incoming job payload.
 *   - Runs the no-op processor for each job.
 *   - Logs completion and failures to stdout.
 *
 * Returns the Worker instance so callers can close it on shutdown.
 */
export function startWorker(config: WorkerConfig): Worker {
  const connection = parseRedisConnection(config.redisUrl);

  const jobRepo = new ProcessingJobRepository();
  const attemptRepo = new ProcessingJobAttemptRepository();

  const worker = new Worker(
    PROCESSING_QUEUE,
    async (job) => {
      const payload = validateJobPayload(job.data);
      await noopProcessor(payload.processingJobId, { jobRepo, attemptRepo });
    },
    {
      connection,
      concurrency: config.concurrency,
    },
  );

  worker.on('completed', (job) => {
    const payload = job.data as { processingJobId: string };
    console.log(`[worker] ✓ job ${job.id} — processingJobId: ${payload.processingJobId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] ✗ job ${job?.id ?? '?'} failed: ${err.message}`);
  });

  return worker;
}
