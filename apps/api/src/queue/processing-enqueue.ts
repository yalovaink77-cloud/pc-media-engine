import type { ProcessingJobPayload } from './names.js';
import { PROCESSING_QUEUE } from './names.js';

export type ProcessingJobSummary = {
  id: string;
  processingType: string;
  status: string;
};

export interface ProcessingEnqueuer {
  enqueueProcessingJobs(jobs: ProcessingJobSummary[]): Promise<void>;
}

export type ProcessingEnqueueFn = (
  queueName: string,
  payload: ProcessingJobPayload,
) => Promise<void>;

/** Create an enqueuer backed by an injectable add function (tests) or BullMQ (production). */
export function createProcessingEnqueuer(enqueueFn: ProcessingEnqueueFn): ProcessingEnqueuer {
  return {
    async enqueueProcessingJobs(jobs) {
      for (const job of jobs) {
        await enqueueFn(PROCESSING_QUEUE, { processingJobId: job.id });
      }
    },
  };
}
