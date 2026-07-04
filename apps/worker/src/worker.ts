import { resolve } from 'node:path';

import {
  MediaAssetRepository,
  ProcessingArtifactRepository,
  ProcessingJobAttemptRepository,
  ProcessingJobRepository,
} from '@pcme/database';
import { LocalStorageProvider } from '@pcme/media';
import { Worker } from 'bullmq';

import type { WorkerConfig } from './config.js';
import { parseRedisConnection } from './config.js';
import { dispatchJob } from './processors/dispatch.js';
import { PROCESSING_QUEUE } from './queue/names.js';
import { validateJobPayload } from './queue/payload.js';

/**
 * Create and start a BullMQ Worker connected to the `processing` queue.
 *
 * The worker:
 *   - Validates the incoming job payload.
 *   - Dispatches each job to its type-specific processor (thumbnail, …).
 *   - Logs completion and failures to stdout.
 *
 * Returns the Worker instance so callers can close it on shutdown.
 */
export function startWorker(config: WorkerConfig): Worker {
  const connection = parseRedisConnection(config.redisUrl);

  const jobRepo = new ProcessingJobRepository();
  const attemptRepo = new ProcessingJobAttemptRepository();
  const assetRepo = new MediaAssetRepository();
  const artifactRepo = new ProcessingArtifactRepository();

  if (!config.storageLocalRoot) {
    console.warn('[worker] STORAGE_LOCAL_ROOT is not set — thumbnail processor will fail');
  }

  const storageProvider = new LocalStorageProvider({
    rootDir: resolve(config.storageLocalRoot || '/tmp/pcme-storage'),
  });

  const worker = new Worker(
    PROCESSING_QUEUE,
    async (job) => {
      const payload = validateJobPayload(job.data);
      await dispatchJob(payload.processingJobId, {
        jobRepo,
        attemptRepo,
        assetRepo,
        storageProvider,
        artifactRepo,
      });
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
