/**
 * Queue service abstraction — Sprint 32.
 *
 * Decouples the API routes from BullMQ so tests can inject a lightweight mock.
 * The production implementation lives in bullmq-queue-service.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueueStatus = {
  /** Whether the queue is paused (not consuming new jobs). */
  paused: boolean;
  /** Jobs waiting to be picked up by a worker. */
  waiting: number;
  /** Jobs currently being processed. */
  active: number;
  /** Jobs scheduled to run at a future time. */
  delayed: number;
  /** Jobs that finished successfully. */
  completed: number;
  /** Jobs that failed after all retry attempts. */
  failed: number;
};

export class QueueJobNotFoundError extends Error {
  constructor(public readonly jobId: string) {
    super(`Job not found: ${jobId}`);
    this.name = 'QueueJobNotFoundError';
  }
}

export class QueueJobStateError extends Error {
  constructor(
    public readonly jobId: string,
    reason: string,
  ) {
    super(`Cannot operate on job ${jobId}: ${reason}`);
    this.name = 'QueueJobStateError';
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Operational queue management contract.
 * All methods are async — implementations may call BullMQ or return from memory.
 */
export interface QueueService {
  /** Return current queue counts and paused state. */
  getStatus(): Promise<QueueStatus>;
  /** Pause the queue — the worker stops picking up new jobs. */
  pause(): Promise<void>;
  /** Resume a paused queue. */
  resume(): Promise<void>;
  /**
   * Drain all waiting (and optionally delayed) jobs.
   * Equivalent to "clear the backlog without stopping the worker."
   */
  drain(): Promise<void>;
  /**
   * Retry a failed job by ID.
   * Throws `QueueJobNotFoundError` if the job does not exist.
   * Throws `QueueJobStateError` if the job is not in a retriable state.
   */
  retryJob(jobId: string): Promise<void>;
  /**
   * Remove a job from the queue entirely.
   * Throws `QueueJobNotFoundError` if the job does not exist.
   */
  removeJob(jobId: string): Promise<void>;
}
