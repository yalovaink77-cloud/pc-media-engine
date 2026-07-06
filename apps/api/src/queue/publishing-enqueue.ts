import { Queue } from 'bullmq';

import type { PublishingJobPayload } from './publishing-payload.js';

export const PUBLISHING_QUEUE = 'publishing' as const;

export type PublishingQueueEnqueuer = {
  enqueue(payload: PublishingJobPayload): Promise<string>;
  close(): Promise<void>;
};

export type PublishingEnqueueOptions = {
  maxRetries?: number;
  backoffMs?: number;
};

function computeScheduleDelay(scheduledFor: string | undefined): number {
  if (!scheduledFor) return 0;
  return Math.max(0, new Date(scheduledFor).getTime() - Date.now());
}

export function createPublishingEnqueuer(
  connection: { host: string; port: number },
  options: PublishingEnqueueOptions = {},
): PublishingQueueEnqueuer {
  const { maxRetries = 3, backoffMs = 5000 } = options;

  const queue = new Queue(PUBLISHING_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: maxRetries + 1,
      backoff: { type: 'exponential', delay: backoffMs },
    },
  });

  return {
    async enqueue(payload: PublishingJobPayload): Promise<string> {
      const delay = computeScheduleDelay(payload.scheduledFor);
      const job = await queue.add('publish', payload, delay > 0 ? { delay } : undefined);
      return job.id ?? '';
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}

export function buildPublishingEnqueuer(
  redisUrl: string | undefined,
  config: { publishingMaxRetries?: number; publishingBackoffMs?: number },
): PublishingQueueEnqueuer | undefined {
  if (!redisUrl) return undefined;

  const parsed = new URL(redisUrl);
  return createPublishingEnqueuer(
    { host: parsed.hostname, port: parseInt(parsed.port || '6379', 10) },
    {
      maxRetries: config.publishingMaxRetries,
      backoffMs: config.publishingBackoffMs,
    },
  );
}
