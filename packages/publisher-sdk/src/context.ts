/**
 * PublisherContext — runtime context threaded through publish operations.
 *
 * Providers can use this for structured logging, distributed tracing,
 * and retry-aware behaviour.  All fields are optional so callers that
 * do not need tracing can simply omit the context object.
 */

export type PublisherContext = {
  /**
   * Unique ID for this single publish attempt.
   * A new requestId is assigned on every retry.
   */
  requestId?: string;

  /**
   * ID that groups all attempts for the same logical publish job.
   * Stays constant across retries.
   */
  correlationId?: string;

  /**
   * 1-based attempt counter (1 = first try, 2 = first retry, …).
   * Providers can use this to adjust behaviour on subsequent attempts.
   */
  attemptNumber?: number;

  /**
   * When the job was originally scheduled to be processed.
   * Set by the scheduler; undefined for immediate jobs.
   */
  scheduledFor?: Date;

  /**
   * Arbitrary key/value metadata the caller wants to pass through.
   * Providers should include this in log events where helpful.
   */
  meta?: Record<string, unknown>;
};
