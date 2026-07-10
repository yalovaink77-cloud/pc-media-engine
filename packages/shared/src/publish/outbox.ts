import type { PublishingHandoffPackagePayload } from './handoff-package.js';
import type { ProjectScopedPersistenceContext } from './persistence.js';

/** Lifecycle status for a durable publishing outbox record. */
export type PublishingOutboxStatus =
  'pending' | 'scheduled' | 'processing' | 'succeeded' | 'failed' | 'dead-letter' | 'cancelled';

/** Redacted diagnostics safe to persist for a publish attempt. */
export interface PublishingAttemptDiagnostics {
  readonly httpStatus?: number;
  readonly providerId?: string;
  readonly finishReason?: string;
  readonly detail?: string;
}

/** Append-only publish attempt history entry. */
export interface PublishingAttemptRecord {
  readonly attemptId: string;
  readonly outboxId: string;
  readonly attemptNumber: number;
  readonly providerId: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: 'started' | 'succeeded' | 'failed';
  readonly errorCode?: string;
  readonly retryable?: boolean;
  readonly diagnostics?: PublishingAttemptDiagnostics;
  readonly remoteContentId?: string;
  readonly remoteUrl?: string;
}

/** Durable publishing outbox record for worker-driven handoff delivery. */
export interface PublishingOutboxRecord {
  readonly outboxId: string;
  readonly handoffId: string;
  readonly artifactId: string;
  readonly reviewId: string;
  readonly jobId: string;
  readonly requestId: string;
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly targetId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly format: string;
  readonly packagePayload: PublishingHandoffPackagePayload;
  readonly status: PublishingOutboxStatus;
  readonly priority: number;
  readonly scheduledAt?: string;
  readonly availableAt: string;
  readonly lockedAt?: string;
  readonly lockedBy?: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly lastError?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly version: number;
}

/** Input for enqueueing a handoff package into the publishing outbox. */
export interface EnqueuePublishingOutboxInput {
  readonly package: PublishingHandoffPackagePayload;
  readonly priority?: number;
  readonly scheduledAt?: string;
  readonly maxAttempts?: number;
  readonly availableAt?: string;
}

/** Input for claiming the next available outbox record. */
export interface ClaimNextPublishingOutboxInput {
  readonly workerId: string;
  readonly now?: Date;
}

/** Input for marking an outbox record as failed. */
export interface MarkPublishingOutboxFailedInput {
  readonly outboxId: string;
  readonly expectedVersion: number;
  readonly errorCode: string;
  readonly retryable: boolean;
  readonly message: string;
  readonly attempt: Omit<PublishingAttemptRecord, 'attemptId' | 'outboxId'>;
  readonly now?: Date;
}

/** Input for marking an outbox record as succeeded. */
export interface MarkPublishingOutboxSucceededInput {
  readonly outboxId: string;
  readonly expectedVersion: number;
  readonly attempt: Omit<PublishingAttemptRecord, 'attemptId' | 'outboxId'>;
  readonly now?: Date;
}

/** Input for appending a publish attempt without terminal state transition. */
export interface AppendPublishingAttemptInput {
  readonly outboxId: string;
  readonly attempt: Omit<PublishingAttemptRecord, 'attemptId' | 'outboxId'>;
}

/** Generic persistence contract for durable publishing outbox records. */
export interface PublishingOutboxRepository {
  enqueue(
    context: ProjectScopedPersistenceContext,
    input: EnqueuePublishingOutboxInput,
  ): Promise<PublishingOutboxRecord>;
  getById(
    context: ProjectScopedPersistenceContext,
    outboxId: string,
  ): Promise<PublishingOutboxRecord | undefined>;
  getByHandoffId(
    context: ProjectScopedPersistenceContext,
    handoffId: string,
  ): Promise<PublishingOutboxRecord | undefined>;
  claimNext(
    context: ProjectScopedPersistenceContext,
    input: ClaimNextPublishingOutboxInput,
  ): Promise<PublishingOutboxRecord | undefined>;
  markSucceeded(
    context: ProjectScopedPersistenceContext,
    input: MarkPublishingOutboxSucceededInput,
  ): Promise<PublishingOutboxRecord>;
  markFailed(
    context: ProjectScopedPersistenceContext,
    input: MarkPublishingOutboxFailedInput,
  ): Promise<PublishingOutboxRecord>;
  moveToDeadLetter(
    context: ProjectScopedPersistenceContext,
    input: {
      outboxId: string;
      expectedVersion: number;
      message: string;
      attempt: Omit<PublishingAttemptRecord, 'attemptId' | 'outboxId'>;
      now?: Date;
    },
  ): Promise<PublishingOutboxRecord>;
  cancel(
    context: ProjectScopedPersistenceContext,
    input: { outboxId: string; expectedVersion: number; now?: Date },
  ): Promise<PublishingOutboxRecord>;
  listAttempts(
    context: ProjectScopedPersistenceContext,
    outboxId: string,
  ): Promise<readonly PublishingAttemptRecord[]>;
  appendAttempt(
    context: ProjectScopedPersistenceContext,
    input: AppendPublishingAttemptInput,
  ): Promise<PublishingAttemptRecord>;
}
