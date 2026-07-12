import type {
  ContentReviewDecision,
  ContentReviewerIdentity,
  ContentReviewFinding,
  ContentReviewRequest,
  ContentReviewStatus,
} from './content-review.js';
import type { GeneratedContentStatus } from './generated-content.js';
import {
  ContentReviewTerminalStateError,
  ContentReviewValidationError,
} from './persistence-errors.js';

const TERMINAL_STATUSES = new Set<ContentReviewStatus>([
  'approved',
  'approved-with-notes',
  'rejected',
]);

const NON_APPROVABLE_ARTIFACT_STATUSES = new Set<GeneratedContentStatus>(['invalid', 'rejected']);

function hasUnresolvedHighSeverity(findings: readonly ContentReviewFinding[]): boolean {
  return findings.some((finding) => finding.severity === 'high' && finding.resolved !== true);
}

function hasDisallowedFindingsForApprovalWithNotes(
  findings: readonly ContentReviewFinding[],
): boolean {
  return findings.some((finding) => finding.severity === 'high' && finding.resolved !== true);
}

function mapDecisionToStatus(decision: ContentReviewDecision): ContentReviewStatus {
  switch (decision) {
    case 'approve':
      return 'approved';
    case 'approve-with-notes':
      return 'approved-with-notes';
    case 'request-changes':
      return 'changes-requested';
    case 'reject':
      return 'rejected';
  }
}

function assertReviewer(reviewId: string, reviewer: ContentReviewerIdentity): void {
  if (!reviewer.reviewerId.trim()) {
    throw new ContentReviewValidationError(
      reviewId,
      'missing-reviewer',
      'Reviewer identity is required to submit a decision',
    );
  }
}

function assertNotExpired(review: ContentReviewRequest, nowMs: number): void {
  const expiresAtMs = Date.parse(review.expiresAt);
  if (!Number.isNaN(expiresAtMs) && nowMs > expiresAtMs) {
    throw new ContentReviewValidationError(
      review.reviewId,
      'expired',
      'Content review has expired',
    );
  }
}

function assertNotTerminal(review: ContentReviewRequest): void {
  if (TERMINAL_STATUSES.has(review.status)) {
    throw new ContentReviewTerminalStateError(review.reviewId, review.status);
  }
}

function assertArtifactApprovable(reviewId: string, artifactStatus: GeneratedContentStatus): void {
  if (NON_APPROVABLE_ARTIFACT_STATUSES.has(artifactStatus)) {
    throw new ContentReviewValidationError(
      reviewId,
      'artifact-not-approvable',
      `Artifact status ${artifactStatus} cannot be approved`,
    );
  }
}

function assertReviewableStatus(reviewId: string, status: ContentReviewStatus): void {
  if (status === 'revision-in-progress') {
    throw new ContentReviewValidationError(
      reviewId,
      'revision-in-progress',
      'Content review is awaiting revision completion',
    );
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
  const nowMs = input.nowMs ?? Date.now();
  const findings = input.findings ?? [];

  assertNotExpired(input.review, nowMs);
  assertNotTerminal(input.review);
  assertReviewableStatus(input.review.reviewId, input.review.status);
  assertReviewer(input.review.reviewId, input.reviewer);

  if (input.decision === 'approve' || input.decision === 'approve-with-notes') {
    assertArtifactApprovable(input.review.reviewId, input.review.artifactStatus);
  }

  if (input.decision === 'approve') {
    if (hasUnresolvedHighSeverity(findings)) {
      throw new ContentReviewValidationError(
        input.review.reviewId,
        'high-severity-finding',
        'High-severity unresolved findings block approval',
      );
    }
  }

  if (input.decision === 'approve-with-notes') {
    if (hasDisallowedFindingsForApprovalWithNotes(findings)) {
      throw new ContentReviewValidationError(
        input.review.reviewId,
        'high-severity-finding',
        'Approved-with-notes allows only low or medium findings',
      );
    }
  }

  return mapDecisionToStatus(input.decision);
}

export function isTerminalReviewStatus(status: ContentReviewStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
