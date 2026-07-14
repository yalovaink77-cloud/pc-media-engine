import type {
  ContentReviewDecision,
  ContentReviewerIdentity,
  ContentReviewFinding,
  ContentReviewPolicy,
  EditorialIntelligenceReport,
} from '@pcme/shared';

export type {
  ContentReviewCheckId,
  ContentReviewDecision,
  ContentReviewerIdentity,
  ContentReviewFinding,
  ContentReviewHistoryEvent,
  ContentReviewPolicy,
  ContentReviewRequest,
  ContentReviewResult,
  ContentReviewSeverity,
  ContentReviewStatus,
} from '@pcme/shared';

/** Options for creating a content review request from an artifact. */
export interface CreateContentReviewRequestOptions {
  readonly reviewIdGenerator?: (input: { artifactId: string; createdAt: string }) => string;
  readonly policy?: Partial<ContentReviewPolicy>;
  readonly createdAt?: string;
  readonly expiresAt?: string;
  readonly editorialReport?: EditorialIntelligenceReport;
}

/** Input for submitting a review decision. */
export interface SubmitContentReviewDecisionInput {
  readonly reviewId: string;
  readonly decision: ContentReviewDecision;
  readonly reviewer: ContentReviewerIdentity;
  readonly notes?: string;
  readonly findings?: readonly ContentReviewFinding[];
}
