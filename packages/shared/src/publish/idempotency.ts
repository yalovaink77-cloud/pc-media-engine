import type { ProjectScopedPersistenceContext } from './persistence.js';

/** Lifecycle status for a durable publishing idempotency record. */
export type PublishingIdempotencyStatus = 'reserved' | 'completed' | 'failed' | 'expired';

/** Durable idempotency record for publish-once semantics per target/handoff. */
export interface PublishingIdempotencyRecord {
  readonly idempotencyKey: string;
  readonly targetId: string;
  readonly handoffId: string;
  readonly requestHash: string;
  readonly status: PublishingIdempotencyStatus;
  readonly remoteContentId?: string;
  readonly remoteUrl?: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly completedAt?: string;
  readonly expiresAt?: string;
}

/** Result returned when reserving an idempotency key. */
export type PublishingIdempotencyReserveResult =
  | { readonly action: 'proceed' }
  | {
      readonly action: 'return-existing';
      readonly record: PublishingIdempotencyRecord;
    }
  | { readonly action: 'blocked'; readonly reason: string };

/** Input for reserving an idempotency key before publishing. */
export interface ReservePublishingIdempotencyInput {
  readonly targetId: string;
  readonly handoffId: string;
  readonly requestHash: string;
  readonly ttlMs?: number;
  readonly now?: Date;
}

/** Generic persistence contract for publish idempotency records. */
export interface PublishingIdempotencyRepository {
  reserve(
    context: ProjectScopedPersistenceContext,
    input: ReservePublishingIdempotencyInput,
  ): Promise<PublishingIdempotencyReserveResult>;
  get(
    context: ProjectScopedPersistenceContext,
    idempotencyKey: string,
  ): Promise<PublishingIdempotencyRecord | undefined>;
  markCompleted(
    context: ProjectScopedPersistenceContext,
    input: {
      idempotencyKey: string;
      remoteContentId?: string;
      remoteUrl?: string;
      now?: Date;
    },
  ): Promise<PublishingIdempotencyRecord>;
  markFailed(
    context: ProjectScopedPersistenceContext,
    input: {
      idempotencyKey: string;
      retryable: boolean;
      now?: Date;
    },
  ): Promise<PublishingIdempotencyRecord>;
  releaseExpired(context: ProjectScopedPersistenceContext, now?: Date): Promise<number>;
}

/** Build the default idempotency key for a target/handoff pair. */
export function buildPublishingIdempotencyKey(targetId: string, handoffId: string): string {
  return `${targetId}:${handoffId}`;
}
