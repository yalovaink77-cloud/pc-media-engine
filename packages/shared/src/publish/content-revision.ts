import type { ContentReviewCheckId, ContentReviewerIdentity } from './content-review.js';
import type {
  AcceptanceCriteria,
  EditorialFindingId,
  FindingCategory,
  FindingCode,
  FindingConfidence,
  FindingRecommendation,
  FindingSeverity,
} from './editorial-finding.js';
import type { EditorialModuleId } from './editorial-intelligence.js';
import type { RevisionLocation } from './revision-location.js';

export type { RevisionLocation } from './revision-location.js';

/** Priority band assigned to a structured revision request. */
export type RevisionPriority = 'must-fix' | 'should-fix' | 'nice-to-have';

/** Lifecycle status for a structured revision request. */
export type RevisionStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

/** Global safety constraints applied to every revision generation pass. */
export interface RevisionGlobalConstraints {
  readonly preserveProviderWhitespace: true;
  readonly noDictionaryRepair: true;
  readonly doNotInventSources: true;
  readonly doNotInventUrls: true;
  readonly humanApprovalRequired: true;
}

/** Structured revision item mapped from an editorial intelligence finding. */
export interface ContentRevisionItem {
  readonly itemId: string;
  readonly findingId: EditorialFindingId;
  readonly module: FindingCategory;
  readonly code: FindingCode;
  readonly severity: FindingSeverity;
  readonly confidence: FindingConfidence;
  readonly reason: string;
  readonly recommendation: FindingRecommendation;
  readonly acceptanceCriteria: AcceptanceCriteria;
  readonly checkId: ContentReviewCheckId;
  readonly location?: RevisionLocation;
}

/** Findings grouped by intelligence module for revision execution. */
export interface RevisionModuleBundle {
  readonly module: EditorialModuleId;
  readonly items: readonly ContentRevisionItem[];
}

/** Structured revision request derived from editorial intelligence findings. */
export interface ContentRevisionRequest {
  readonly revisionRequestId: string;
  readonly reviewId: string;
  readonly priorArtifactId: string;
  readonly rootArtifactId: string;
  readonly sourceSnapshotId: string;
  readonly reviewer: ContentReviewerIdentity;
  readonly priority: RevisionPriority;
  readonly status: RevisionStatus;
  readonly globalConstraints: RevisionGlobalConstraints;
  readonly moduleBundles: readonly RevisionModuleBundle[];
  readonly humanNotes?: string;
  readonly createdAt: string;
}

/** Summary comparing editorial intelligence findings across revision passes. */
export interface RevisionComparisonSummary {
  readonly resolvedCount: number;
  readonly persistingCount: number;
  readonly newCount: number;
  readonly blockingRemainingCount: number;
  readonly resolvedFindingIds: readonly EditorialFindingId[];
  readonly persistingFindingIds: readonly EditorialFindingId[];
  readonly newFindingIds: readonly EditorialFindingId[];
}

export const DEFAULT_REVISION_GLOBAL_CONSTRAINTS = Object.freeze({
  preserveProviderWhitespace: true,
  noDictionaryRepair: true,
  doNotInventSources: true,
  doNotInventUrls: true,
  humanApprovalRequired: true,
} as const satisfies RevisionGlobalConstraints);

/** Validation error raised when a revision request cannot be built safely. */
export class RevisionValidationError extends Error {
  readonly code: string;
  readonly reviewId?: string;

  constructor(code: string, message: string, reviewId?: string) {
    super(message);
    this.name = 'RevisionValidationError';
    this.code = code;
    this.reviewId = reviewId;
  }
}
