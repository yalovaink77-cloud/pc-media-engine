import { Worker } from 'bullmq';

import type { WorkerConfig } from './config.js';
import { parseRedisConnection } from './config.js';
import { processPublishingJob } from './processors/publishing.processor.js';
import { PUBLISHING_QUEUE } from './queue/names.js';
import { validatePublishingJobPayload } from './queue/publishing-payload.js';

/**
 * Create and start a BullMQ Worker connected to the `publishing` queue.
 *
 * Publisher is selected via PUBLISHER_DRIVER (default: mock).
 * Returns the Worker instance so callers can close it on shutdown.
 */
export function startPublishingWorker(config: WorkerConfig): Worker {
  const connection = parseRedisConnection(config.redisUrl);

  const worker = new Worker(
    PUBLISHING_QUEUE,
    async (job) => {
      const payload = validatePublishingJobPayload(job.data);
      const result = await processPublishingJob(payload, {
        publisherDriver: config.publisherDriver,
      });
      return result;
    },
    {
      connection,
      concurrency: config.concurrency,
    },
  );

  worker.on('completed', (job, result) => {
    const flow = result as {
      success?: boolean;
      media?: { externalId?: string };
      post?: { externalId?: string };
    };
    console.log(
      `[publishing-worker] ✓ job ${job.id} — success=${flow.success} media=${flow.media?.externalId ?? '—'} post=${flow.post?.externalId ?? '—'}`,
    );
  });

  worker.on('failed', (job, err) => {
    console.error(`[publishing-worker] ✗ job ${job?.id ?? '?'} failed: ${err.message}`);
  });

  return worker;
}
