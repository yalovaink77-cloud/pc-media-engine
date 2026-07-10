import type {
  ProjectScopedPersistenceContext,
  PublishingOutboxRecord,
  PublishingOutboxRepository,
} from '@pcme/shared';

/** Result status for a publishing enqueue operation. */
export type PublishingEnqueueStatus = 'created' | 'existing' | 'rejected';

/** Non-sensitive warning emitted during enqueue. */
export interface PublishingEnqueueWarning {
  readonly code: string;
  readonly message: string;
}

/** Options for enqueueing a ready handoff package. */
export interface PublishingEnqueueOptions {
  readonly priority?: number;
  readonly scheduledAt?: string;
  readonly availableAt?: string;
  readonly maxAttempts?: number;
  readonly now?: Date;
}

/** Result returned by the publishing enqueue service. */
export interface PublishingEnqueueResult {
  readonly status: PublishingEnqueueStatus;
  readonly handoffId: string;
  readonly targetId: string;
  readonly outboxId?: string;
  readonly outbox?: PublishingOutboxRecord;
  readonly requestHash?: string;
  readonly priority?: number;
  readonly maxAttempts?: number;
  readonly scheduled: boolean;
  readonly warnings: readonly PublishingEnqueueWarning[];
}

/** Options for creating a publishing enqueue service. */
export interface PublishingEnqueueServiceOptions {
  readonly context: ProjectScopedPersistenceContext;
  readonly outboxRepository: PublishingOutboxRepository;
  readonly defaultMaxAttempts?: number;
}

/** Generic publishing enqueue service contract. */
export interface PublishingEnqueueService {
  enqueue(
    handoff: import('../handoff/types.js').PublishingHandoffPackage,
    options?: PublishingEnqueueOptions,
  ): Promise<PublishingEnqueueResult>;
}
