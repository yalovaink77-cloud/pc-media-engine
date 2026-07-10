import { GenerationJobError } from '../errors.js';

/** Base error for content review gate failures. */
export class ContentReviewError extends GenerationJobError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ContentReviewError';
  }
}

/** Thrown when a content review request cannot be found. */
export class ContentReviewNotFoundError extends ContentReviewError {
  readonly reviewId: string;

  constructor(reviewId: string) {
    super(`Content review not found: ${reviewId}`);
    this.name = 'ContentReviewNotFoundError';
    this.reviewId = reviewId;
  }
}

/** Thrown when a review request has expired. */
export class ContentReviewExpiredError extends ContentReviewError {
  readonly reviewId: string;

  constructor(reviewId: string) {
    super(`Content review has expired: ${reviewId}`);
    this.name = 'ContentReviewExpiredError';
    this.reviewId = reviewId;
  }
}

/** Thrown when a review is already in a terminal state. */
export class ContentReviewTerminalStateError extends ContentReviewError {
  readonly reviewId: string;
  readonly status: string;

  constructor(reviewId: string, status: string) {
    super(`Content review ${reviewId} is in terminal state: ${status}`);
    this.name = 'ContentReviewTerminalStateError';
    this.reviewId = reviewId;
    this.status = status;
  }
}

/** Thrown when a review decision fails validation. */
export class ContentReviewDecisionError extends ContentReviewError {
  readonly reviewId: string;
  readonly code: string;

  constructor(reviewId: string, code: string, message: string) {
    super(message);
    this.name = 'ContentReviewDecisionError';
    this.reviewId = reviewId;
    this.code = code;
  }
}

/** Thrown when reviewer identity is missing or invalid. */
export class ContentReviewMissingReviewerError extends ContentReviewDecisionError {
  constructor(reviewId: string) {
    super(reviewId, 'missing-reviewer', 'Reviewer identity is required to submit a decision');
    this.name = 'ContentReviewMissingReviewerError';
  }
}

/** Thrown when a review status transition is not allowed. */
export class ContentReviewTransitionError extends ContentReviewDecisionError {
  readonly fromStatus: string;
  readonly toStatus: string;

  constructor(reviewId: string, fromStatus: string, toStatus: string) {
    super(
      reviewId,
      'invalid-transition',
      `Cannot transition content review ${reviewId} from ${fromStatus} to ${toStatus}`,
    );
    this.name = 'ContentReviewTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}
