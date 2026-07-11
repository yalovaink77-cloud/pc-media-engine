import type { PublishingHandoffPackagePayload } from '@pcme/shared';

import type { PublishingHandoffPackage } from '../handoff/types.js';

/** Convert a ready handoff package into a persistable outbox payload. */
export function toPublishingHandoffPackagePayload(
  handoff: PublishingHandoffPackage,
): PublishingHandoffPackagePayload {
  return Object.freeze({
    handoffId: handoff.handoffId,
    artifactId: handoff.artifactId,
    reviewId: handoff.reviewId,
    jobId: handoff.jobId,
    requestId: handoff.requestId,
    sourceId: handoff.sourceId,
    snapshotId: handoff.snapshotId,
    contentType: handoff.contentType,
    locale: handoff.locale,
    format: handoff.format,
    content: handoff.content,
    target: Object.freeze({
      targetId: handoff.target.targetId,
      platform: handoff.target.platform,
      supportedFormats: Object.freeze([...handoff.target.supportedFormats]),
    }),
    publishingMetadata: Object.freeze({
      title: handoff.publishingMetadata.title,
      slug: handoff.publishingMetadata.slug,
      excerpt: handoff.publishingMetadata.excerpt,
      tags: handoff.publishingMetadata.tags
        ? Object.freeze([...handoff.publishingMetadata.tags])
        : undefined,
      categories: handoff.publishingMetadata.categories
        ? Object.freeze([...handoff.publishingMetadata.categories])
        : undefined,
      author: handoff.publishingMetadata.author,
      featuredImageRef: handoff.publishingMetadata.featuredImageRef,
      canonicalUrl: handoff.publishingMetadata.canonicalUrl,
      publishStatus: handoff.publishingMetadata.publishStatus,
      scheduledAt: handoff.publishingMetadata.scheduledAt,
    }),
    policySnapshot: Object.freeze({
      safetyConstraints: Object.freeze([...handoff.policySnapshot.safetyConstraints]),
      affiliateConstraints: Object.freeze([...handoff.policySnapshot.affiliateConstraints]),
      citationRequirements: Object.freeze([...handoff.policySnapshot.citationRequirements]),
      blockedFields: Object.freeze([...handoff.policySnapshot.blockedFields]),
      strictMode: handoff.policySnapshot.strictMode,
      contextComplete: handoff.policySnapshot.contextComplete,
      warningCount: handoff.policySnapshot.warningCount,
    }),
    reviewSummary: Object.freeze({
      reviewId: handoff.reviewSummary.reviewId,
      status: handoff.reviewSummary.status,
      decision: handoff.reviewSummary.decision,
      reviewerId: handoff.reviewSummary.reviewerId,
      findingCount: handoff.reviewSummary.findingCount,
      notes: handoff.reviewSummary.notes,
    }),
    warnings: Object.freeze(handoff.warnings.map((warning) => Object.freeze({ ...warning }))),
    status: handoff.status,
    createdAt: handoff.createdAt,
  });
}
