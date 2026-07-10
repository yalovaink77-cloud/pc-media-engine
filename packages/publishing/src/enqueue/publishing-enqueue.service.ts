import { PublishingOutboxDuplicateError } from '@pcme/shared';

import type { PublishingHandoffPackage } from '../handoff/types.js';
import { validateHandoffPackageContent } from '../handoff/validate.js';
import { buildPublishingWorkerRequestHash } from '../worker/request-hash.js';
import { PublishingEnqueueNotReadyError, PublishingEnqueuePayloadConflictError } from './errors.js';
import { toPublishingHandoffPackagePayload } from './handoff-payload.js';
import type {
  PublishingEnqueueOptions,
  PublishingEnqueueResult,
  PublishingEnqueueService,
  PublishingEnqueueServiceOptions,
} from './types.js';

function buildRejectedResult(
  handoff: PublishingHandoffPackage,
  warnings: PublishingEnqueueResult['warnings'],
): PublishingEnqueueResult {
  return Object.freeze({
    status: 'rejected',
    handoffId: handoff.handoffId,
    targetId: handoff.target.targetId,
    scheduled: Boolean(handoff.publishingMetadata.scheduledAt),
    warnings,
  });
}

/** Create a generic publishing enqueue service backed by a durable outbox repository. */
export function createPublishingEnqueueService(
  options: PublishingEnqueueServiceOptions,
): PublishingEnqueueService {
  return Object.freeze({
    enqueue: (handoff: PublishingHandoffPackage, enqueueOptions: PublishingEnqueueOptions = {}) =>
      enqueueHandoff(options, handoff, enqueueOptions),
  });
}

async function enqueueHandoff(
  serviceOptions: PublishingEnqueueServiceOptions,
  handoff: PublishingHandoffPackage,
  enqueueOptions: PublishingEnqueueOptions,
): Promise<PublishingEnqueueResult> {
  if (handoff.status !== 'ready') {
    throw new PublishingEnqueueNotReadyError(handoff.handoffId, handoff.status);
  }

  const contentValidation = validateHandoffPackageContent(
    { content: handoff.content } as import('@pcme/shared').GeneratedContentArtifact,
    handoff.publishingMetadata,
  );
  if (contentValidation) {
    return buildRejectedResult(
      handoff,
      Object.freeze([
        Object.freeze({
          code: contentValidation.code,
          message: contentValidation.message,
        }),
      ]),
    );
  }

  const payload = toPublishingHandoffPackagePayload(handoff);
  const requestHash = buildPublishingWorkerRequestHash(payload);
  const priority = enqueueOptions.priority ?? 0;
  const maxAttempts = enqueueOptions.maxAttempts ?? serviceOptions.defaultMaxAttempts ?? 5;
  const scheduledAt = enqueueOptions.scheduledAt ?? handoff.publishingMetadata.scheduledAt;
  const availableAt = enqueueOptions.availableAt;
  const warnings = Object.freeze(
    handoff.warnings.map((warning) =>
      Object.freeze({ code: warning.code, message: warning.message }),
    ),
  );

  try {
    const outbox = await serviceOptions.outboxRepository.enqueue(serviceOptions.context, {
      package: payload,
      priority,
      scheduledAt,
      availableAt,
      maxAttempts,
    });

    return Object.freeze({
      status: 'created',
      handoffId: handoff.handoffId,
      targetId: handoff.target.targetId,
      outboxId: outbox.outboxId,
      outbox,
      requestHash,
      priority: outbox.priority,
      maxAttempts: outbox.maxAttempts,
      scheduled: outbox.status === 'scheduled' || Boolean(scheduledAt),
      warnings,
    });
  } catch (error) {
    if (!(error instanceof PublishingOutboxDuplicateError)) {
      throw error;
    }

    const existing = await serviceOptions.outboxRepository.getByHandoffId(
      serviceOptions.context,
      handoff.handoffId,
    );
    if (!existing) {
      throw error;
    }

    const existingHash = buildPublishingWorkerRequestHash(existing.packagePayload);
    if (existingHash !== requestHash) {
      throw new PublishingEnqueuePayloadConflictError(handoff.handoffId);
    }

    return Object.freeze({
      status: 'existing',
      handoffId: handoff.handoffId,
      targetId: handoff.target.targetId,
      outboxId: existing.outboxId,
      outbox: existing,
      requestHash,
      priority: existing.priority,
      maxAttempts: existing.maxAttempts,
      scheduled: existing.status === 'scheduled' || Boolean(existing.scheduledAt),
      warnings,
    });
  }
}
