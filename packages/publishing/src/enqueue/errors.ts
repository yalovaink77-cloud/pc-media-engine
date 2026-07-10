/** Thrown when enqueueing a handoff with a conflicting payload for an existing outbox record. */
export class PublishingEnqueuePayloadConflictError extends Error {
  readonly handoffId: string;

  constructor(handoffId: string) {
    super(`Publishing enqueue payload conflict for handoff: ${handoffId}`);
    this.name = 'PublishingEnqueuePayloadConflictError';
    this.handoffId = handoffId;
  }
}

/** Thrown when attempting to enqueue a handoff that is not ready. */
export class PublishingEnqueueNotReadyError extends Error {
  readonly handoffId: string;
  readonly handoffStatus: string;

  constructor(handoffId: string, handoffStatus: string) {
    super(`Publishing handoff ${handoffId} is not ready for enqueue (status=${handoffStatus})`);
    this.name = 'PublishingEnqueueNotReadyError';
    this.handoffId = handoffId;
    this.handoffStatus = handoffStatus;
  }
}
