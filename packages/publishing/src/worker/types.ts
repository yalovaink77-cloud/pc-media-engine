import type {
  ProjectScopedPersistenceContext,
  PublishingIdempotencyRepository,
  PublishingOutboxRepository,
} from '@pcme/shared';

import type { PublishingTargetAdapter } from '../handoff/types.js';

/** Execution status returned by a single worker cycle. */
export type PublishingWorkerExecutionStatus =
  'idle' | 'succeeded' | 'failed-retryable' | 'failed-terminal' | 'dead-letter';

/** Non-sensitive warning emitted during worker execution. */
export interface PublishingWorkerWarning {
  readonly code: string;
  readonly message: string;
}

/** Deterministic result returned by a single worker cycle. */
export interface PublishingWorkerResult {
  readonly workerId: string;
  readonly executionStatus: PublishingWorkerExecutionStatus;
  readonly outboxId?: string;
  readonly handoffId?: string;
  readonly targetId?: string;
  readonly attemptNumber?: number;
  readonly publishResultStatus?: 'succeeded' | 'failed' | 'skipped';
  readonly remoteContentId?: string;
  readonly remoteUrl?: string;
  readonly retryScheduled?: boolean;
  readonly deadLetter?: boolean;
  readonly warnings?: readonly PublishingWorkerWarning[];
}

/** Registry of publishing target adapters keyed by targetId. */
export interface PublishingTargetAdapterRegistry {
  get(targetId: string): PublishingTargetAdapter | undefined;
  has(targetId: string): boolean;
}

/** Options for creating a generic publishing worker. */
export interface PublishingWorkerOptions {
  readonly context: ProjectScopedPersistenceContext;
  readonly outboxRepository: PublishingOutboxRepository;
  readonly idempotencyRepository: PublishingIdempotencyRepository;
  readonly adapters: PublishingTargetAdapterRegistry | readonly PublishingTargetAdapter[];
  readonly workerId: string;
  readonly leaseDurationMs?: number;
}

/** Single-cycle publishing worker contract. */
export interface PublishingWorker {
  readonly workerId: string;
  runOnce(input?: { readonly now?: Date }): Promise<PublishingWorkerResult>;
}
