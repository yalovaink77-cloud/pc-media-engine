/**
 * BullMQ-backed QueueService implementation — Sprint 32.
 *
 * Wraps a single BullMQ `Queue` instance.  The queue is closed via `close()`.
 * Production code instantiates one service per managed queue (publishing queue).
 */

import { Queue } from 'bullmq';

import type { QueueService, QueueStatus } from './queue-service.js';
import { QueueJobNotFoundError, QueueJobStateError } from './queue-service.js';

export type BullMqConnection = {
  host: string;
  port: number;
};

/**
 * Create a BullMQ-backed QueueService.
 * Returns the service plus a `close()` method to shut down the BullMQ connection.
 */
export function createBullMqQueueService(
  queueName: string,
  connection: BullMqConnection,
): QueueService & { close(): Promise<void> } {
  const queue = new Queue(queueName, { connection });

  return {
    async getStatus(): Promise<QueueStatus> {
      const [counts, paused] = await Promise.all([
        queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed'),
        queue.isPaused(),
      ]);
      return {
        paused,
        waiting: counts['waiting'] ?? 0,
        active: counts['active'] ?? 0,
        delayed: counts['delayed'] ?? 0,
        completed: counts['completed'] ?? 0,
        failed: counts['failed'] ?? 0,
      };
    },

    async pause(): Promise<void> {
      await queue.pause();
    },

    async resume(): Promise<void> {
      await queue.resume();
    },

    async drain(): Promise<void> {
      // drain(false) removes waiting jobs only; drain(true) also removes delayed.
      await queue.drain();
    },

    async retryJob(jobId: string): Promise<void> {
      const job = await queue.getJob(jobId);
      if (!job) throw new QueueJobNotFoundError(jobId);

      const state = await job.getState();
      if (state !== 'failed') {
        throw new QueueJobStateError(jobId, `expected state "failed" but got "${state}"`);
      }
      await job.retry();
    },

    async removeJob(jobId: string): Promise<void> {
      const job = await queue.getJob(jobId);
      if (!job) throw new QueueJobNotFoundError(jobId);
      await job.remove();
    },

    async close(): Promise<void> {
      await queue.close();
    },
  };
}
