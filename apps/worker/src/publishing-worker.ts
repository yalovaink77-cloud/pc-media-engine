import { PublishedContentRepository } from '@pcme/database';
import type { PublishingFlowResult } from '@pcme/publishing';
import { Worker } from 'bullmq';

import type { WorkerConfig } from './config.js';
import { parseRedisConnection } from './config.js';
import type { PublishingProcessorDeps } from './processors/publishing.processor.js';
import { processPublishingJob } from './processors/publishing.processor.js';
import type { PublishedContentWriter } from './publishing/persist-published-content.js';
import { PUBLISHING_QUEUE } from './queue/names.js';
import type { PublishingJobPayload } from './queue/publishing-payload.js';
import { validatePublishingJobPayload } from './queue/publishing-payload.js';

export type PublishingWorkerOverrides = {
  createPublisher?: PublishingProcessorDeps['createPublisher'];
  publishedContentRepo?: PublishedContentWriter;
};

/**
 * Minimal job context needed for retry logic — isolates BullMQ dependency.
 * Allows unit-testing without a live BullMQ instance.
 */
export type PublishingJobContext = {
  /** Number of attempts already made before this execution (0 on first run). */
  attemptsMade: number;
  /** Total attempts allowed (initial + retries). */
  totalAttempts: number;
  jobId: string;
};

/**
 * Core execution function: runs `processPublishingJob`, then decides whether
 * to return (success or expected skip) or throw (genuine failure → BullMQ retry).
 *
 * Extracted for unit-testability without a live BullMQ Worker.
 */
export async function executePublishingJobWithRetry(
  payload: PublishingJobPayload,
  context: PublishingJobContext,
  deps: PublishingProcessorDeps,
): Promise<PublishingFlowResult> {
  const attempt = context.attemptsMade + 1;
  const tag = `[publishing-worker] job=${context.jobId} attempt=${attempt}/${context.totalAttempts}`;

  console.log(`${tag} — starting`);

  const result = await processPublishingJob(payload, deps);

  if (result.skipped) {
    console.log(`${tag} — ${result.reason ?? 'skipped'} — completing without retry`);
    return result;
  }

  if (result.success) {
    console.log(
      `${tag} — published media=${result.media?.externalId ?? '—'} post=${result.post?.externalId ?? '—'}`,
    );
    return result;
  }

  // Genuine failure — throw so BullMQ schedules the next retry.
  const isLastAttempt = attempt >= context.totalAttempts;
  if (isLastAttempt) {
    console.error(`${tag} — failed, retries exhausted: ${result.message ?? 'unknown error'}`);
  } else {
    console.log(`${tag} — failed, retry scheduled: ${result.message ?? 'unknown error'}`);
    deps.metricsService?.inc('retriesTotal');
  }

  throw new Error(result.message ?? 'Publishing failed');
}

/**
 * Create and start a BullMQ Worker connected to the `publishing` queue.
 *
 * - Throws for genuine failures so BullMQ applies exponential backoff retries.
 * - Returns normally for skipped duplicates (no retry).
 * - Retry settings (attempts + backoff) are configured on the Queue producer side
 *   via `createPublishingEnqueuer`.
 */
export function startPublishingWorker(
  config: WorkerConfig,
  overrides: PublishingWorkerOverrides = {},
): Worker {
  const connection = parseRedisConnection(config.redisUrl);
  const publishedContentRepo = overrides.publishedContentRepo ?? new PublishedContentRepository();

  const worker = new Worker(
    PUBLISHING_QUEUE,
    async (job) => {
      const payload = validatePublishingJobPayload(job.data);
      const totalAttempts = job.opts.attempts ?? 1;

      return executePublishingJobWithRetry(
        payload,
        { attemptsMade: job.attemptsMade, totalAttempts, jobId: job.id ?? '?' },
        {
          publisherDriver: config.publisherDriver,
          publishedContentRepo,
          createPublisher: overrides.createPublisher,
        },
      );
    },
    {
      connection,
      concurrency: config.concurrency,
    },
  );

  worker.on('completed', (job, result) => {
    const flow = result as PublishingFlowResult;
    if (flow.skipped) {
      console.log(`[publishing-worker] ⤼ job ${job.id} completed — ${flow.reason ?? 'skipped'}`);
    } else {
      console.log(
        `[publishing-worker] ✓ job ${job.id} — media=${flow.media?.externalId ?? '—'} post=${flow.post?.externalId ?? '—'}`,
      );
    }
  });

  worker.on('failed', (job, err) => {
    const attempt = (job?.attemptsMade ?? 0) + 1;
    const total = job?.opts?.attempts ?? 1;
    if (attempt >= total) {
      console.error(
        `[publishing-worker] ✗ job ${job?.id ?? '?'} — retries exhausted after ${total} attempts: ${err.message}`,
      );
    } else {
      console.log(
        `[publishing-worker] ↺ job ${job?.id ?? '?'} — attempt ${attempt}/${total} failed, retry pending: ${err.message}`,
      );
    }
  });

  return worker;
}
