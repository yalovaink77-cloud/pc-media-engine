/**
 * BullMQ-backed QueueService implementation — Sprint 32.
 *
 * Wraps a single BullMQ `Queue` instance.  The queue is closed via `close()`.
 * Production code instantiates one service per managed queue (publishing queue).
 */

import { type JobType, Queue } from 'bullmq';

import { mapJobToDetail, mapJobToListItem } from './job-mapper.js';
import type { JobListQuery, JobListResult } from './job-types.js';
import {
  DEFAULT_JOB_LIMIT,
  isJobStatus,
  JOB_STATUSES,
  MAX_JOB_LIMIT,
  MAX_JOBS_FETCH,
} from './job-types.js';
import type { QueueService, QueueStatus } from './queue-service.js';
import { QueueJobNotFoundError, QueueJobStateError } from './queue-service.js';

async function collectJobs(
  queue: Queue,
  states: readonly string[],
): Promise<Array<{ job: Awaited<ReturnType<Queue['getJob']>>; state: string }>> {
  const entries: Array<{ job: NonNullable<Awaited<ReturnType<Queue['getJob']>>>; state: string }> =
    [];
  const seen = new Set<string>();

  for (const state of states) {
    const jobs = await queue.getJobs([state as JobType], 0, MAX_JOBS_FETCH - 1, false);
    for (const job of jobs) {
      if (!job?.id || seen.has(job.id)) continue;
      seen.add(job.id);
      const resolvedState = await job.getState();
      entries.push({ job, state: resolvedState });
    }
  }

  return entries;
}

function applyJobFilters(
  items: Awaited<ReturnType<typeof mapJobToListItem>>[],
  query: JobListQuery,
): Awaited<ReturnType<typeof mapJobToListItem>>[] {
  return items.filter((job) => {
    if (query.publisher && job.publisher !== query.publisher) return false;
    if (query.projectId && job.projectId !== query.projectId) return false;
    if (query.assetId && job.assetId !== query.assetId) return false;
    if (query.status && job.status !== query.status) return false;
    return true;
  });
}

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

    async listJobs(query: JobListQuery, publisherDriver: string): Promise<JobListResult> {
      const limit = Math.min(Math.max(query.limit ?? DEFAULT_JOB_LIMIT, 1), MAX_JOB_LIMIT);
      const offset = Math.max(query.offset ?? 0, 0);

      const states = query.status && isJobStatus(query.status) ? [query.status] : [...JOB_STATUSES];

      const entries = await collectJobs(queue, states);
      const mapped = await Promise.all(
        entries.map(({ job, state }) => mapJobToListItem(job!, state, publisherDriver)),
      );

      const filtered = applyJobFilters(mapped, query);
      filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const total = filtered.length;
      const jobs = filtered.slice(offset, offset + limit);

      return { jobs, total, limit, offset };
    },

    async getJob(jobId: string, publisherDriver: string) {
      const job = await queue.getJob(jobId);
      if (!job) throw new QueueJobNotFoundError(jobId);
      const [state, paused] = await Promise.all([job.getState(), queue.isPaused()]);
      return mapJobToDetail(job, state, publisherDriver, paused);
    },

    async close(): Promise<void> {
      await queue.close();
    },
  };
}
