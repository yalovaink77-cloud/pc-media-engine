import { Queue } from 'bullmq';

import { PUBLISHING_QUEUE } from './names.js';
import type { PublishingJobPayload } from './publishing-payload.js';

export type PublishingQueueEnqueuer = {
  enqueue(payload: PublishingJobPayload): Promise<void>;
  close(): Promise<void>;
};

export type PublishingEnqueueOptions = {
  /** Total retry attempts after the initial attempt. Default: 3. */
  maxRetries?: number;
  /** Initial exponential backoff delay in ms. Default: 5000. */
  backoffMs?: number;
};

/**
 * Compute the BullMQ job delay in ms from an optional scheduledFor datetime.
 *
 * - Absent / empty string → 0 (immediate)
 * - Past or present       → 0 (immediate)
 * - Future                → positive ms from now
 *
 * Callers are responsible for validating the datetime string before calling
 * this function (see `validatePublishingJobPayload`).
 */
export function computeScheduleDelay(scheduledFor: string | undefined): number {
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
    async enqueue(payload: PublishingJobPayload): Promise<void> {
      const delay = computeScheduleDelay(payload.scheduledFor);
      await queue.add('publish', payload, delay > 0 ? { delay } : undefined);
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}
