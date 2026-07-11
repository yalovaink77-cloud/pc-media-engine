import type { PublishingAttemptRecord, PublishingOutboxRecord } from '@pcme/shared';
import { buildPublishingIdempotencyKey } from '@pcme/shared';

import type { PublishingTargetAdapter } from '../handoff/types.js';
import { createPublishingTargetAdapterRegistry } from './adapter-registry.js';
import { sanitizeWorkerErrorMessage, toPublishingHandoffPackage } from './payload.js';
import { buildPublishingWorkerRequestHash } from './request-hash.js';
import { isRetryablePublishErrorCode } from './retry-policy.js';
import type {
  PublishingTargetAdapterRegistry,
  PublishingWorker,
  PublishingWorkerExecutionStatus,
  PublishingWorkerOptions,
  PublishingWorkerResult,
  PublishingWorkerWarning,
} from './types.js';

function resolveRegistry(
  adapters: PublishingTargetAdapterRegistry | readonly PublishingTargetAdapter[],
): PublishingTargetAdapterRegistry {
  if ('get' in adapters && typeof adapters.get === 'function' && !Array.isArray(adapters)) {
    return adapters;
  }
  return createPublishingTargetAdapterRegistry(adapters as readonly PublishingTargetAdapter[]);
}

function buildIdleResult(workerId: string): PublishingWorkerResult {
  return Object.freeze({
    workerId,
    executionStatus: 'idle',
  });
}

function buildResult(input: {
  workerId: string;
  executionStatus: PublishingWorkerExecutionStatus;
  claimed: PublishingOutboxRecord;
  attemptNumber: number;
  publishResultStatus: 'succeeded' | 'failed' | 'skipped';
  remoteContentId?: string;
  remoteUrl?: string;
  retryScheduled?: boolean;
  deadLetter?: boolean;
  warnings?: readonly PublishingWorkerWarning[];
}): PublishingWorkerResult {
  return Object.freeze({
    workerId: input.workerId,
    executionStatus: input.executionStatus,
    outboxId: input.claimed.outboxId,
    handoffId: input.claimed.handoffId,
    targetId: input.claimed.targetId,
    attemptNumber: input.attemptNumber,
    publishResultStatus: input.publishResultStatus,
    remoteContentId: input.remoteContentId,
    remoteUrl: input.remoteUrl,
    retryScheduled: input.retryScheduled,
    deadLetter: input.deadLetter,
    warnings: input.warnings,
  });
}

function buildAttempt(
  claimed: PublishingOutboxRecord,
  startedAt: string,
  completedAt: string,
  status: PublishingAttemptRecord['status'],
  input?: {
    errorCode?: string;
    retryable?: boolean;
    remoteContentId?: string;
    remoteUrl?: string;
    detail?: string;
  },
): Omit<PublishingAttemptRecord, 'attemptId' | 'outboxId'> {
  return {
    attemptNumber: claimed.attemptCount + 1,
    providerId: claimed.targetId,
    startedAt,
    completedAt,
    status,
    errorCode: input?.errorCode,
    retryable: input?.retryable,
    diagnostics: input?.detail
      ? Object.freeze({ detail: sanitizeWorkerErrorMessage(input.detail) })
      : undefined,
    remoteContentId: input?.remoteContentId,
    remoteUrl: input?.remoteUrl,
  };
}

/** Create a generic single-cycle publishing worker. */
export function createPublishingWorker(options: PublishingWorkerOptions): PublishingWorker {
  const registry = resolveRegistry(options.adapters);

  return Object.freeze({
    workerId: options.workerId,
    runOnce: (input?: { readonly now?: Date }) => runOnce(options, registry, input?.now),
  });
}

async function runOnce(
  options: PublishingWorkerOptions,
  registry: PublishingTargetAdapterRegistry,
  nowInput?: Date,
): Promise<PublishingWorkerResult> {
  const now = nowInput ?? new Date();
  const startedAt = now.toISOString();
  const claimed = await options.outboxRepository.claimNext(options.context, {
    workerId: options.workerId,
    now,
  });

  if (!claimed) {
    return buildIdleResult(options.workerId);
  }

  const attemptNumber = claimed.attemptCount + 1;
  const payload = claimed.packagePayload;
  const handoffPackage = toPublishingHandoffPackage(payload);
  const requestHash = buildPublishingWorkerRequestHash(payload);
  const idempotencyKey = buildPublishingIdempotencyKey(claimed.targetId, claimed.handoffId);

  const adapter = registry.get(claimed.targetId);
  if (!adapter) {
    const updated = await options.outboxRepository.markFailed(options.context, {
      outboxId: claimed.outboxId,
      expectedVersion: claimed.version,
      errorCode: 'unknown-target',
      retryable: false,
      message: sanitizeWorkerErrorMessage(`No adapter registered for target ${claimed.targetId}`),
      attempt: buildAttempt(claimed, startedAt, now.toISOString(), 'failed', {
        errorCode: 'unknown-target',
        retryable: false,
        detail: `Unknown target ${claimed.targetId}`,
      }),
      now,
    });

    return buildResult({
      workerId: options.workerId,
      executionStatus: 'failed-terminal',
      claimed,
      attemptNumber,
      publishResultStatus: 'failed',
      deadLetter: updated.status === 'dead-letter',
      retryScheduled: false,
    });
  }

  const validation = adapter.validate(handoffPackage);
  if (!validation.valid) {
    const errorCode = validation.errors[0]?.code ?? 'validation';
    const message = sanitizeWorkerErrorMessage(
      validation.errors[0]?.message ?? 'Handoff package failed adapter validation',
    );
    const updated = await options.outboxRepository.markFailed(options.context, {
      outboxId: claimed.outboxId,
      expectedVersion: claimed.version,
      errorCode,
      retryable: false,
      message,
      attempt: buildAttempt(claimed, startedAt, now.toISOString(), 'failed', {
        errorCode,
        retryable: false,
        detail: message,
      }),
      now,
    });

    return buildResult({
      workerId: options.workerId,
      executionStatus: updated.status === 'dead-letter' ? 'dead-letter' : 'failed-terminal',
      claimed,
      attemptNumber,
      publishResultStatus: 'failed',
      deadLetter: updated.status === 'dead-letter',
      retryScheduled: false,
    });
  }

  const reservation = await options.idempotencyRepository.reserve(options.context, {
    targetId: claimed.targetId,
    handoffId: claimed.handoffId,
    requestHash,
    now,
  });

  if (reservation.action === 'return-existing') {
    const completedAt = now.toISOString();
    await options.outboxRepository.markSucceeded(options.context, {
      outboxId: claimed.outboxId,
      expectedVersion: claimed.version,
      attempt: buildAttempt(claimed, startedAt, completedAt, 'succeeded', {
        remoteContentId: reservation.record.remoteContentId,
        remoteUrl: reservation.record.remoteUrl,
        detail: 'Returned existing idempotency result without republishing',
      }),
      now,
    });

    return buildResult({
      workerId: options.workerId,
      executionStatus: 'succeeded',
      claimed,
      attemptNumber,
      publishResultStatus: 'skipped',
      remoteContentId: reservation.record.remoteContentId,
      remoteUrl: reservation.record.remoteUrl,
      retryScheduled: false,
      deadLetter: false,
    });
  }

  if (reservation.action === 'blocked') {
    const message = sanitizeWorkerErrorMessage(reservation.reason);
    const updated = await options.outboxRepository.markFailed(options.context, {
      outboxId: claimed.outboxId,
      expectedVersion: claimed.version,
      errorCode: 'idempotency-blocked',
      retryable: true,
      message,
      attempt: buildAttempt(claimed, startedAt, now.toISOString(), 'failed', {
        errorCode: 'idempotency-blocked',
        retryable: true,
        detail: message,
      }),
      now,
    });

    return buildResult({
      workerId: options.workerId,
      executionStatus: 'failed-retryable',
      claimed,
      attemptNumber,
      publishResultStatus: 'failed',
      retryScheduled: updated.status === 'failed',
      deadLetter: updated.status === 'dead-letter',
    });
  }

  const publishResult = await adapter.publish(handoffPackage);
  const completedAt = now.toISOString();

  if (publishResult.success) {
    await options.idempotencyRepository.markCompleted(options.context, {
      idempotencyKey,
      remoteContentId: publishResult.externalId,
      remoteUrl: publishResult.url,
      now,
    });
    await options.outboxRepository.markSucceeded(options.context, {
      outboxId: claimed.outboxId,
      expectedVersion: claimed.version,
      attempt: buildAttempt(claimed, startedAt, completedAt, 'succeeded', {
        remoteContentId: publishResult.externalId,
        remoteUrl: publishResult.url,
      }),
      now,
    });

    return buildResult({
      workerId: options.workerId,
      executionStatus: 'succeeded',
      claimed,
      attemptNumber,
      publishResultStatus: 'succeeded',
      remoteContentId: publishResult.externalId,
      remoteUrl: publishResult.url,
      retryScheduled: false,
      deadLetter: false,
    });
  }

  const errorCode = publishResult.error?.code ?? 'publish-failed';
  const retryable = isRetryablePublishErrorCode(errorCode);
  const message = sanitizeWorkerErrorMessage(
    publishResult.error?.message ?? 'Publishing target adapter returned failure',
  );

  await options.idempotencyRepository.markFailed(options.context, {
    idempotencyKey,
    retryable,
    now,
  });

  const updated = await options.outboxRepository.markFailed(options.context, {
    outboxId: claimed.outboxId,
    expectedVersion: claimed.version,
    errorCode,
    retryable,
    message,
    attempt: buildAttempt(claimed, startedAt, completedAt, 'failed', {
      errorCode,
      retryable,
      detail: message,
    }),
    now,
  });

  return buildResult({
    workerId: options.workerId,
    executionStatus:
      updated.status === 'dead-letter'
        ? 'dead-letter'
        : retryable
          ? 'failed-retryable'
          : 'failed-terminal',
    claimed,
    attemptNumber,
    publishResultStatus: 'failed',
    retryScheduled: updated.status === 'failed',
    deadLetter: updated.status === 'dead-letter',
  });
}
