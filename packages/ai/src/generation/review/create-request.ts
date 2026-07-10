import { createHash, randomUUID } from 'node:crypto';

import type { GeneratedContentArtifact } from '../artifact/types.js';
import { buildRequiredChecks, resolveContentReviewPolicy } from './policy.js';
import type {
  ContentReviewHistoryEvent,
  ContentReviewRequest,
  CreateContentReviewRequestOptions,
} from './types.js';

export function buildDeterministicReviewId(input: {
  artifactId: string;
  createdAt: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

function clonePolicySnapshot(
  policySnapshot: GeneratedContentArtifact['policySnapshot'],
): GeneratedContentArtifact['policySnapshot'] {
  return Object.freeze({
    ...policySnapshot,
    safetyConstraints: Object.freeze([...policySnapshot.safetyConstraints]),
    affiliateConstraints: Object.freeze([...policySnapshot.affiliateConstraints]),
    citationRequirements: Object.freeze([...policySnapshot.citationRequirements]),
    blockedFields: Object.freeze([...policySnapshot.blockedFields]),
  });
}

/** Create a review request from a generated content artifact without mutating it. */
export function createContentReviewRequest(
  artifact: GeneratedContentArtifact,
  options?: CreateContentReviewRequestOptions,
): ContentReviewRequest {
  const policy = resolveContentReviewPolicy(options?.policy);
  const createdAt = options?.createdAt ?? new Date().toISOString();
  const reviewId = (options?.reviewIdGenerator ?? buildDeterministicReviewId)({
    artifactId: artifact.artifactId,
    createdAt,
  });
  const expiresAt =
    options?.expiresAt ?? new Date(Date.parse(createdAt) + policy.expirationMs).toISOString();

  return Object.freeze({
    reviewId,
    artifactId: artifact.artifactId,
    jobId: artifact.jobId,
    contentType: artifact.contentType,
    locale: artifact.locale,
    artifactStatus: artifact.status,
    policySnapshot: clonePolicySnapshot(artifact.policySnapshot),
    warnings: Object.freeze(artifact.warnings.map((warning) => Object.freeze({ ...warning }))),
    requiredChecks: Object.freeze([...buildRequiredChecks(artifact)]),
    status: 'pending-review',
    createdAt,
    expiresAt,
  });
}

export function createReviewCreatedHistoryEvent(
  review: ContentReviewRequest,
  timestamp?: string,
): ContentReviewHistoryEvent {
  return Object.freeze({
    eventId: randomUUID(),
    reviewId: review.reviewId,
    type: 'created',
    status: review.status,
    timestamp: timestamp ?? review.createdAt,
  });
}
