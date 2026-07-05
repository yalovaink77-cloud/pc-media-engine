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
      await queue.add('publish', payload);
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}
