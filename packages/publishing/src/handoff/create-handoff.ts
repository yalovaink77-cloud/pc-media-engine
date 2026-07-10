import { createHash } from 'node:crypto';

import type { GenerationPolicySnapshot } from '@pcme/ai';

import type {
  CreatePublishingHandoffOptions,
  CreatePublishingHandoffResult,
  PublishingHandoffPackage,
  PublishingHandoffRequest,
  PublishingHandoffWarning,
  PublishingMetadata,
  PublishingReviewSummary,
  PublishingTarget,
} from './types.js';
import { sanitizePublishingMetadata, validatePublishingHandoff } from './validate.js';

export function buildDeterministicHandoffId(input: {
  artifactId: string;
  reviewId: string;
  targetId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

function clonePolicySnapshot(policySnapshot: GenerationPolicySnapshot): GenerationPolicySnapshot {
  return Object.freeze({
    ...policySnapshot,
    safetyConstraints: Object.freeze([...policySnapshot.safetyConstraints]),
    affiliateConstraints: Object.freeze([...policySnapshot.affiliateConstraints]),
    citationRequirements: Object.freeze([...policySnapshot.citationRequirements]),
    blockedFields: Object.freeze([...policySnapshot.blockedFields]),
  });
}

function buildReviewSummary(input: PublishingHandoffRequest): PublishingReviewSummary {
  const notesEvent = [...input.review.history]
    .reverse()
    .find((event) => event.type === 'decision-submitted' && event.notes);

  return Object.freeze({
    reviewId: input.review.review.reviewId,
    status: input.review.review.status,
    decision: input.review.latestDecision,
    reviewerId: input.review.reviewer?.reviewerId,
    findingCount: input.review.findings.length,
    notes: notesEvent?.notes,
  });
}

function cloneMetadata(metadata: PublishingMetadata): PublishingMetadata {
  return Object.freeze({
    ...metadata,
    tags: metadata.tags ? Object.freeze([...metadata.tags]) : undefined,
    categories: metadata.categories ? Object.freeze([...metadata.categories]) : undefined,
  });
}

function cloneTarget(target: PublishingTarget): PublishingTarget {
  return Object.freeze({
    ...target,
    supportedFormats: Object.freeze([...target.supportedFormats]),
  });
}

function buildWarnings(
  validationWarnings: readonly PublishingHandoffWarning[],
): readonly PublishingHandoffWarning[] {
  return Object.freeze(validationWarnings.map((warning) => Object.freeze({ ...warning })));
}

/** Convert an approved artifact and review into a publish-ready handoff package. */
export function createPublishingHandoff(
  input: PublishingHandoffRequest,
  options?: CreatePublishingHandoffOptions,
): CreatePublishingHandoffResult {
  const validation = validatePublishingHandoff(input);
  const createdAt = options?.createdAt ?? new Date().toISOString();
  const handoffId = (options?.handoffIdGenerator ?? buildDeterministicHandoffId)({
    artifactId: input.artifact.artifactId,
    reviewId: input.review.review.reviewId,
    targetId: input.target.targetId,
  });

  const pkg: PublishingHandoffPackage = Object.freeze({
    handoffId,
    artifactId: input.artifact.artifactId,
    reviewId: input.review.review.reviewId,
    jobId: input.artifact.jobId,
    requestId: input.artifact.requestId,
    sourceId: input.artifact.sourceId,
    snapshotId: input.artifact.snapshotId,
    contentType: input.artifact.contentType,
    locale: input.artifact.locale,
    format: input.artifact.format,
    content: input.artifact.content,
    target: cloneTarget(input.target),
    publishingMetadata: cloneMetadata(sanitizePublishingMetadata(input.metadata)),
    policySnapshot: clonePolicySnapshot(input.artifact.policySnapshot),
    reviewSummary: buildReviewSummary(input),
    warnings: buildWarnings(validation.warnings),
    status: validation.status,
    createdAt,
  });

  return Object.freeze({
    package: pkg,
    validation,
  });
}
