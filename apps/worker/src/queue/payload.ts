/**
 * BullMQ job payload for the `processing` queue.
 *
 * Deliberately minimal — the worker loads full job details from the database.
 * Adding fields here must be coordinated with all enqueue call-sites.
 */
export type ProcessingJobPayload = {
  /** The database ID of the ProcessingJob to execute. */
  processingJobId: string;
};

export class PayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

/**
 * Validate and narrow unknown queue job data to `ProcessingJobPayload`.
 *
 * Throws `PayloadValidationError` for any invalid input so BullMQ marks
 * the job as failed immediately (no retries for malformed payloads).
 */
export function validateJobPayload(data: unknown): ProcessingJobPayload {
  if (data === null || typeof data !== 'object') {
    throw new PayloadValidationError('Payload must be a non-null object');
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj['processingJobId'] !== 'string' || obj['processingJobId'].trim() === '') {
    throw new PayloadValidationError('processingJobId must be a non-empty string');
  }

  return { processingJobId: obj['processingJobId'] };
}
