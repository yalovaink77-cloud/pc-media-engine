import type { PublishingHandoffPackagePayload } from '@pcme/shared';

import {
  assertPersistableArtifactContent,
  assertPersistableText,
  ContentWorkflowValidationError,
} from './content-workflow-validation.js';

export type PublishingHandoffOutboxStatusDb =
  'pending' | 'scheduled' | 'processing' | 'succeeded' | 'failed' | 'dead_letter' | 'cancelled';

export type PublishingHandoffAttemptStatusDb = 'started' | 'succeeded' | 'failed';

export type PublishingIdempotencyStatusDb = 'reserved' | 'completed' | 'failed' | 'expired';

const TERMINAL_OUTBOX_STATUSES = new Set<PublishingHandoffOutboxStatusDb>([
  'succeeded',
  'dead_letter',
  'cancelled',
]);

export function toDbPublishingOutboxStatus(
  status: import('@pcme/shared').PublishingOutboxStatus,
): PublishingHandoffOutboxStatusDb {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'scheduled':
      return 'scheduled';
    case 'processing':
      return 'processing';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'dead-letter':
      return 'dead_letter';
    case 'cancelled':
      return 'cancelled';
  }
}

export function fromDbPublishingOutboxStatus(
  status: PublishingHandoffOutboxStatusDb,
): import('@pcme/shared').PublishingOutboxStatus {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'scheduled':
      return 'scheduled';
    case 'processing':
      return 'processing';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'dead_letter':
      return 'dead-letter';
    case 'cancelled':
      return 'cancelled';
  }
}

export function toDbPublishingAttemptStatus(
  status: 'started' | 'succeeded' | 'failed',
): PublishingHandoffAttemptStatusDb {
  return status;
}

export function fromDbPublishingAttemptStatus(
  status: PublishingHandoffAttemptStatusDb,
): 'started' | 'succeeded' | 'failed' {
  return status;
}

export function toDbPublishingIdempotencyStatus(
  status: import('@pcme/shared').PublishingIdempotencyStatus,
): PublishingIdempotencyStatusDb {
  return status;
}

export function fromDbPublishingIdempotencyStatus(
  status: PublishingIdempotencyStatusDb,
): import('@pcme/shared').PublishingIdempotencyStatus {
  return status;
}

export function isTerminalPublishingOutboxStatus(status: PublishingHandoffOutboxStatusDb): boolean {
  return TERMINAL_OUTBOX_STATUSES.has(status);
}

/** Validate a handoff package payload before it is persisted in the outbox. */
export function assertPersistableHandoffPackagePayload(
  payload: PublishingHandoffPackagePayload,
): void {
  if (payload.status !== 'ready') {
    throw new ContentWorkflowValidationError(
      `Only ready handoff packages can be enqueued, got ${payload.status}`,
    );
  }

  assertPersistableArtifactContent(payload.content);
  assertPersistableText(payload.publishingMetadata.title, 'publishingMetadata.title');
  assertPersistableText(payload.publishingMetadata.slug, 'publishingMetadata.slug');

  if (payload.publishingMetadata.excerpt) {
    assertPersistableText(payload.publishingMetadata.excerpt, 'publishingMetadata.excerpt');
  }

  for (const warning of payload.warnings) {
    assertPersistableText(warning.message, 'warnings.message');
  }
}

/** Redact diagnostics before persistence. */
export function sanitizePublishingAttemptDiagnostics(
  diagnostics: import('@pcme/shared').PublishingAttemptDiagnostics | undefined,
): import('@pcme/shared').PublishingAttemptDiagnostics | undefined {
  if (!diagnostics) {
    return undefined;
  }

  return Object.freeze({
    httpStatus: diagnostics.httpStatus,
    providerId: diagnostics.providerId,
    finishReason: diagnostics.finishReason,
    detail: diagnostics.detail ? diagnostics.detail.slice(0, 500) : undefined,
  });
}

export function sanitizePublishingErrorMessage(message: string): string {
  return message.slice(0, 1000);
}
