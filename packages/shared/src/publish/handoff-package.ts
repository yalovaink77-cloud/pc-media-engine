import type { ContentReviewDecision, ContentReviewStatus } from './content-review.js';
import type { GenerationPolicySnapshot } from './generation-policy.js';

/** Generic publish-status values for destination metadata. */
export type PublishingMetadataPublishStatus =
  'draft' | 'pending' | 'private' | 'publish' | 'scheduled';

/** Platform-neutral publishing metadata stored in a handoff package payload. */
export interface PublishingHandoffMetadataPayload {
  readonly title: string;
  readonly slug: string;
  readonly excerpt?: string;
  readonly tags?: readonly string[];
  readonly categories?: readonly string[];
  readonly author?: string;
  readonly featuredImageRef?: string;
  readonly canonicalUrl?: string;
  readonly publishStatus?: PublishingMetadataPublishStatus;
  readonly scheduledAt?: string;
}

/** Generic publishing destination descriptor stored in a handoff package payload. */
export interface PublishingHandoffTargetPayload {
  readonly targetId: string;
  readonly platform: string;
  readonly supportedFormats: readonly string[];
}

/** Warning attached to a handoff package payload. */
export interface PublishingHandoffWarningPayload {
  readonly code: string;
  readonly message: string;
  readonly severity: 'warning' | 'error';
}

/** Summary of the review decision included in a handoff package payload. */
export interface PublishingReviewSummaryPayload {
  readonly reviewId: string;
  readonly status: ContentReviewStatus;
  readonly decision?: ContentReviewDecision;
  readonly reviewerId?: string;
  readonly findingCount: number;
  readonly notes?: string;
}

/** Neutral serialized handoff package stored in the publishing outbox. */
export interface PublishingHandoffPackagePayload {
  readonly handoffId: string;
  readonly artifactId: string;
  readonly reviewId: string;
  readonly jobId: string;
  readonly requestId: string;
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly format: string;
  readonly content: string;
  readonly target: PublishingHandoffTargetPayload;
  readonly publishingMetadata: PublishingHandoffMetadataPayload;
  readonly policySnapshot: GenerationPolicySnapshot;
  readonly reviewSummary: PublishingReviewSummaryPayload;
  readonly warnings: readonly PublishingHandoffWarningPayload[];
  readonly status: 'prepared' | 'ready' | 'blocked' | 'published' | 'failed' | 'cancelled';
  readonly createdAt: string;
}
