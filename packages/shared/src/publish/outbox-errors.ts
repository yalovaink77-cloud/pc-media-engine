import { ContentWorkflowPersistenceError } from './persistence-errors.js';

/** Thrown when enqueueing a duplicate handoff outbox record. */
export class PublishingOutboxDuplicateError extends ContentWorkflowPersistenceError {
  readonly handoffId: string;

  constructor(handoffId: string) {
    super(`Publishing outbox record already exists for handoff: ${handoffId}`);
    this.name = 'PublishingOutboxDuplicateError';
    this.handoffId = handoffId;
  }
}

/** Thrown when a publishing outbox record cannot be found. */
export class PublishingOutboxNotFoundError extends ContentWorkflowPersistenceError {
  readonly outboxId: string;

  constructor(outboxId: string) {
    super(`Publishing outbox record not found: ${outboxId}`);
    this.name = 'PublishingOutboxNotFoundError';
    this.outboxId = outboxId;
  }
}

/** Thrown when optimistic concurrency checks fail for an outbox update. */
export class PublishingOutboxConcurrencyError extends ContentWorkflowPersistenceError {
  readonly outboxId: string;
  readonly expectedVersion: number;

  constructor(outboxId: string, expectedVersion: number) {
    super(
      `Publishing outbox record ${outboxId} version conflict: expected version ${expectedVersion}`,
    );
    this.name = 'PublishingOutboxConcurrencyError';
    this.outboxId = outboxId;
    this.expectedVersion = expectedVersion;
  }
}

/** Thrown when an outbox record is in a terminal state. */
export class PublishingOutboxTerminalStateError extends ContentWorkflowPersistenceError {
  readonly outboxId: string;
  readonly status: string;

  constructor(outboxId: string, status: string) {
    super(`Publishing outbox record ${outboxId} is in terminal state: ${status}`);
    this.name = 'PublishingOutboxTerminalStateError';
    this.outboxId = outboxId;
    this.status = status;
  }
}

/** Thrown when idempotency reservation conflicts with an existing request hash. */
export class PublishingIdempotencyConflictError extends ContentWorkflowPersistenceError {
  readonly idempotencyKey: string;

  constructor(idempotencyKey: string) {
    super(`Publishing idempotency key conflict: ${idempotencyKey}`);
    this.name = 'PublishingIdempotencyConflictError';
    this.idempotencyKey = idempotencyKey;
  }
}

/** Thrown when an idempotency record cannot be found. */
export class PublishingIdempotencyNotFoundError extends ContentWorkflowPersistenceError {
  readonly idempotencyKey: string;

  constructor(idempotencyKey: string) {
    super(`Publishing idempotency record not found: ${idempotencyKey}`);
    this.name = 'PublishingIdempotencyNotFoundError';
    this.idempotencyKey = idempotencyKey;
  }
}
