import type {
  ContentReviewDecision,
  ContentReviewerIdentity,
  ContentReviewFinding,
  ContentReviewRequest,
  ContentReviewStatus,
} from '@pcme/shared';
import {
  ContentReviewTerminalStateError as SharedContentReviewTerminalStateError,
  ContentReviewValidationError,
  isTerminalReviewStatus,
  validateReviewDecision as validateReviewDecisionShared,
} from '@pcme/shared';

import type { GeneratedContentStatus } from '../artifact/types.js';
import {
  ContentReviewDecisionError,
  ContentReviewExpiredError,
  ContentReviewMissingReviewerError,
  ContentReviewTerminalStateError,
} from './errors.js';
import type { SubmitContentReviewDecisionInput } from './types.js';

export { isTerminalReviewStatus };

function mapSharedValidationError(error: ContentReviewValidationError): never {
  switch (error.code) {
    case 'missing-reviewer':
      throw new ContentReviewMissingReviewerError(error.reviewId);
    case 'expired':
      throw new ContentReviewExpiredError(error.reviewId);
    default:
      throw new ContentReviewDecisionError(error.reviewId, error.code, error.message);
  }
}

/** Validate a review decision before it is applied. */
export function validateReviewDecision(input: {
  readonly review: ContentReviewRequest;
  readonly decision: ContentReviewDecision;
  readonly reviewer: ContentReviewerIdentity;
  readonly findings?: readonly ContentReviewFinding[];
  readonly nowMs?: number;
}): ContentReviewStatus {
  try {
    return validateReviewDecisionShared(input);
  } catch (error) {
    if (error instanceof ContentReviewValidationError) {
      throw mapSharedValidationError(error);
    }
    if (error instanceof SharedContentReviewTerminalStateError) {
      throw new ContentReviewTerminalStateError(error.reviewId, error.status);
    }
    throw error;
  }
}

export function validateSubmitDecisionInput(
  review: ContentReviewRequest,
  input: SubmitContentReviewDecisionInput,
  nowMs?: number,
): ContentReviewStatus {
  return validateReviewDecision({
    review,
    decision: input.decision,
    reviewer: input.reviewer,
    findings: input.findings,
    nowMs,
  });
}

export type { GeneratedContentStatus };
