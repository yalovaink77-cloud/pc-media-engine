import type {
  ContentReviewRequest,
  ContentReviewResult,
  EditorialIntelligenceReport,
} from '@pcme/shared';

import type { SubmitContentReviewDecisionInput } from '../review/types.js';

export interface BeginRevisionInput {
  readonly reviewId: string;
  readonly revisionRequestId: string;
  readonly timestamp?: string;
}

export interface CompleteRevisionInput {
  readonly reviewId: string;
  readonly activeArtifactId: string;
  readonly activeJobId: string;
  readonly editorialReport: EditorialIntelligenceReport;
  readonly timestamp?: string;
}

/** Store contract used by the editorial revision loop. */
export interface EditorialLoopReviewStore {
  create(review: ContentReviewRequest): ContentReviewResult;
  getById(reviewId: string): ContentReviewResult | undefined;
  submitDecision(input: SubmitContentReviewDecisionInput, nowMs?: number): ContentReviewResult;
  beginRevision(input: BeginRevisionInput): ContentReviewResult;
  completeRevision(input: CompleteRevisionInput): ContentReviewResult;
}
