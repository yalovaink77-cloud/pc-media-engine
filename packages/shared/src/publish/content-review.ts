import type {
  EditorialIntelligenceFinding,
  PublicationReadinessAssessment,
} from './editorial-intelligence.js';
import type { GeneratedContentStatus, GeneratedContentWarning } from './generated-content.js';
import type { GenerationPolicySnapshot } from './generation-policy.js';

/** Lifecycle status for a content review request. */
export type ContentReviewStatus =
  | 'pending-review'
  | 'approved'
  | 'approved-with-notes'
  | 'changes-requested'
  | 'rejected'
  | 'expired';

/** Reviewer decision submitted against a content review request. */
export type ContentReviewDecision = 'approve' | 'approve-with-notes' | 'request-changes' | 'reject';

/** Severity assigned to a review finding. */
export type ContentReviewSeverity = 'low' | 'medium' | 'high';

/** Required human review checks applied before publication. */
export type ContentReviewCheckId =
  | 'safety'
  | 'factual-grounding'
  | 'affiliate-compliance'
  | 'citation-readiness'
  | 'formatting'
  | 'publication-readiness';

/** Structured finding raised during human content review. */
export interface ContentReviewFinding {
  readonly id: string;
  readonly checkId: ContentReviewCheckId;
  readonly code: string;
  readonly message: string;
  readonly severity: ContentReviewSeverity;
  readonly resolved?: boolean;
}

/** Identity of the reviewer submitting a decision. */
export interface ContentReviewerIdentity {
  readonly reviewerId: string;
  readonly displayName?: string;
  readonly role?: string;
}

/** Policy governing a content review request. */
export interface ContentReviewPolicy {
  readonly requiredChecks: readonly ContentReviewCheckId[];
  readonly allowApprovalWithNotes: boolean;
  readonly expirationMs: number;
}

/** Human review request created from a generated content artifact. */
export interface ContentReviewRequest {
  readonly reviewId: string;
  readonly artifactId: string;
  readonly jobId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly artifactStatus: GeneratedContentStatus;
  readonly policySnapshot: GenerationPolicySnapshot;
  readonly warnings: readonly GeneratedContentWarning[];
  readonly requiredChecks: readonly ContentReviewCheckId[];
  readonly status: ContentReviewStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  /** Present when editorial intelligence analysis ran before review creation. */
  readonly editorialReportId?: string;
  /** Findings from pre-review editorial intelligence analysis. */
  readonly preReviewFindings?: readonly EditorialIntelligenceFinding[];
  /** Advisory readiness from editorial intelligence — human approval still required. */
  readonly publicationReadiness?: PublicationReadinessAssessment;
}

/** Append-only audit event recorded for a content review. */
export interface ContentReviewHistoryEvent {
  readonly eventId: string;
  readonly reviewId: string;
  readonly type: 'created' | 'decision-submitted' | 'reopened';
  readonly status: ContentReviewStatus;
  readonly decision?: ContentReviewDecision;
  readonly reviewer?: ContentReviewerIdentity;
  readonly notes?: string;
  readonly findings?: readonly ContentReviewFinding[];
  readonly timestamp: string;
}

/** Current state of a content review including immutable history. */
export interface ContentReviewResult {
  readonly review: ContentReviewRequest;
  readonly history: readonly ContentReviewHistoryEvent[];
  readonly latestDecision?: ContentReviewDecision;
  readonly reviewer?: ContentReviewerIdentity;
  readonly findings: readonly ContentReviewFinding[];
}
