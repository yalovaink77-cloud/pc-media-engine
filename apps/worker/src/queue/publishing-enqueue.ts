import { Queue } from 'bullmq';

import { PUBLISHING_QUEUE } from './names.js';
import type { PublishingJobPayload } from './publishing-payload.js';

export type PublishingQueueEnqueuer = {
  enqueue(payload: PublishingJobPayload): Promise<void>;
  close(): Promise<void>;
};

export function createPublishingEnqueuer(connection: {
  host: string;
  port: number;
}): PublishingQueueEnqueuer {
  const queue = new Queue(PUBLISHING_QUEUE, { connection });

  return {
    async enqueue(payload: PublishingJobPayload): Promise<void> {
      await queue.add('publish', payload);
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}
