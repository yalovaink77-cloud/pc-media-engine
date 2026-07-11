/** Base error for content workflow persistence failures. */
export class ContentWorkflowPersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ContentWorkflowPersistenceError';
  }
}

/** Thrown when saving a duplicate generated content artifact. */
export class GeneratedContentArtifactDuplicateError extends ContentWorkflowPersistenceError {
  readonly artifactId: string;

  constructor(artifactId: string) {
    super(`Generated content artifact already exists: ${artifactId}`);
    this.name = 'GeneratedContentArtifactDuplicateError';
    this.artifactId = artifactId;
  }
}

/** Thrown when a generated content artifact cannot be found. */
export class GeneratedContentArtifactNotFoundError extends ContentWorkflowPersistenceError {
  readonly artifactId: string;

  constructor(artifactId: string) {
    super(`Generated content artifact not found: ${artifactId}`);
    this.name = 'GeneratedContentArtifactNotFoundError';
    this.artifactId = artifactId;
  }
}

/** Thrown when an artifact status transition is not allowed. */
export class GeneratedContentArtifactTransitionError extends ContentWorkflowPersistenceError {
  readonly artifactId: string;
  readonly fromStatus: string;
  readonly toStatus: string;

  constructor(options: { artifactId: string; fromStatus: string; toStatus: string }) {
    super(
      `Cannot transition generated content artifact ${options.artifactId} from ${options.fromStatus} to ${options.toStatus}`,
    );
    this.name = 'GeneratedContentArtifactTransitionError';
    this.artifactId = options.artifactId;
    this.fromStatus = options.fromStatus;
    this.toStatus = options.toStatus;
  }
}

/** Thrown when a content review cannot be found. */
export class ContentReviewNotFoundError extends ContentWorkflowPersistenceError {
  readonly reviewId: string;

  constructor(reviewId: string) {
    super(`Content review not found: ${reviewId}`);
    this.name = 'ContentReviewNotFoundError';
    this.reviewId = reviewId;
  }
}

/** Thrown when optimistic concurrency checks fail for a review update. */
export class ContentReviewConcurrencyError extends ContentWorkflowPersistenceError {
  readonly reviewId: string;
  readonly expectedVersion: number;

  constructor(reviewId: string, expectedVersion: number) {
    super(`Content review ${reviewId} version conflict: expected version ${expectedVersion}`);
    this.name = 'ContentReviewConcurrencyError';
    this.reviewId = reviewId;
    this.expectedVersion = expectedVersion;
  }
}

/** Thrown when a review is already in a terminal state. */
export class ContentReviewTerminalStateError extends ContentWorkflowPersistenceError {
  readonly reviewId: string;
  readonly status: string;

  constructor(reviewId: string, status: string) {
    super(`Content review ${reviewId} is in terminal state: ${status}`);
    this.name = 'ContentReviewTerminalStateError';
    this.reviewId = reviewId;
    this.status = status;
  }
}

/** Thrown when a review status transition is not allowed. */
export class ContentReviewTransitionError extends ContentWorkflowPersistenceError {
  readonly reviewId: string;
  readonly fromStatus: string;
  readonly toStatus: string;

  constructor(reviewId: string, fromStatus: string, toStatus: string) {
    super(`Cannot transition content review ${reviewId} from ${fromStatus} to ${toStatus}`);
    this.name = 'ContentReviewTransitionError';
    this.reviewId = reviewId;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

/** Thrown when a review decision fails validation before persistence. */
export class ContentReviewValidationError extends ContentWorkflowPersistenceError {
  readonly reviewId: string;
  readonly code: string;

  constructor(reviewId: string, code: string, message: string) {
    super(message);
    this.name = 'ContentReviewValidationError';
    this.reviewId = reviewId;
    this.code = code;
  }
}
