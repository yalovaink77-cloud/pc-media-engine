import type { PublishingHandoffPackagePayload } from '@pcme/shared';

import type { PublishingHandoffPackage } from '../handoff/types.js';

/** Rehydrate a frozen handoff package from durable outbox payload without mutation. */
export function toPublishingHandoffPackage(
  payload: PublishingHandoffPackagePayload,
): PublishingHandoffPackage {
  return Object.freeze({
    handoffId: payload.handoffId,
    artifactId: payload.artifactId,
    reviewId: payload.reviewId,
    jobId: payload.jobId,
    requestId: payload.requestId,
    sourceId: payload.sourceId,
    snapshotId: payload.snapshotId,
    contentType: payload.contentType,
    locale: payload.locale,
    format: payload.format,
    content: payload.content,
    target: Object.freeze({
      targetId: payload.target.targetId,
      platform: payload.target.platform,
      supportedFormats: Object.freeze([...payload.target.supportedFormats]),
    }),
    publishingMetadata: Object.freeze({
      title: payload.publishingMetadata.title,
      slug: payload.publishingMetadata.slug,
      excerpt: payload.publishingMetadata.excerpt,
      tags: payload.publishingMetadata.tags
        ? Object.freeze([...payload.publishingMetadata.tags])
        : undefined,
      categories: payload.publishingMetadata.categories
        ? Object.freeze([...payload.publishingMetadata.categories])
        : undefined,
      author: payload.publishingMetadata.author,
      featuredImageRef: payload.publishingMetadata.featuredImageRef,
      canonicalUrl: payload.publishingMetadata.canonicalUrl,
      publishStatus: payload.publishingMetadata.publishStatus,
      scheduledAt: payload.publishingMetadata.scheduledAt,
    }),
    policySnapshot: Object.freeze({
      safetyConstraints: Object.freeze([...payload.policySnapshot.safetyConstraints]),
      affiliateConstraints: Object.freeze([...payload.policySnapshot.affiliateConstraints]),
      citationRequirements: Object.freeze([...payload.policySnapshot.citationRequirements]),
      blockedFields: Object.freeze([...payload.policySnapshot.blockedFields]),
      strictMode: payload.policySnapshot.strictMode,
      contextComplete: payload.policySnapshot.contextComplete,
      warningCount: payload.policySnapshot.warningCount,
    }),
    reviewSummary: Object.freeze({
      reviewId: payload.reviewSummary.reviewId,
      status: payload.reviewSummary.status,
      decision: payload.reviewSummary.decision,
      reviewerId: payload.reviewSummary.reviewerId,
      findingCount: payload.reviewSummary.findingCount,
      notes: payload.reviewSummary.notes,
    }),
    warnings: Object.freeze(payload.warnings.map((warning) => Object.freeze({ ...warning }))),
    status: payload.status,
    createdAt: payload.createdAt,
  });
}

/** Redact worker-facing error messages to avoid leaking sensitive content. */
export function sanitizeWorkerErrorMessage(message: string, maxLength = 240): string {
  const redacted = message
    .replace(/\/(?:home|Users|var|tmp|etc)[^\s'"]+/gi, '[REDACTED_PATH]')
    .replace(/Bearer\s+\S+/gi, '[REDACTED]')
    .replace(/Basic\s+\S+/gi, '[REDACTED]')
    .replace(/password[=:]\S+/gi, 'password=[REDACTED]');
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted;
}
