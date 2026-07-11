import type { GeneratedContentArtifact } from '../artifact/types.js';
import type { ContentReviewCheckId, ContentReviewPolicy } from './types.js';

export const DEFAULT_REQUIRED_CHECKS: readonly ContentReviewCheckId[] = Object.freeze([
  'safety',
  'factual-grounding',
  'affiliate-compliance',
  'citation-readiness',
  'formatting',
  'publication-readiness',
]);

export const DEFAULT_REVIEW_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

export const DEFAULT_CONTENT_REVIEW_POLICY: ContentReviewPolicy = Object.freeze({
  requiredChecks: DEFAULT_REQUIRED_CHECKS,
  allowApprovalWithNotes: true,
  expirationMs: DEFAULT_REVIEW_EXPIRATION_MS,
});

/** Derive required review checks from artifact policy metadata. */
export function buildRequiredChecks(
  _artifact: GeneratedContentArtifact,
): readonly ContentReviewCheckId[] {
  return DEFAULT_REQUIRED_CHECKS;
}

export function resolveContentReviewPolicy(
  overrides?: Partial<ContentReviewPolicy>,
): ContentReviewPolicy {
  return Object.freeze({
    requiredChecks: overrides?.requiredChecks ?? DEFAULT_CONTENT_REVIEW_POLICY.requiredChecks,
    allowApprovalWithNotes:
      overrides?.allowApprovalWithNotes ?? DEFAULT_CONTENT_REVIEW_POLICY.allowApprovalWithNotes,
    expirationMs: overrides?.expirationMs ?? DEFAULT_CONTENT_REVIEW_POLICY.expirationMs,
  });
}
