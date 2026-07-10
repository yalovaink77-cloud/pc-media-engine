import type {
  ContentReviewDecision,
  ContentReviewResult,
  ContentReviewStatus,
  GeneratedContentArtifact,
  GenerationPolicySnapshot,
} from '@pcme/shared';

/** Lifecycle status for a publishing handoff package. */
export type PublishingHandoffStatus =
  'prepared' | 'ready' | 'blocked' | 'published' | 'failed' | 'cancelled';

/** Generic publishing destination descriptor. */
export interface PublishingTarget {
  readonly targetId: string;
  readonly platform: string;
  readonly supportedFormats: readonly string[];
}

/** Generic publish-status values for destination metadata. */
export type PublishingMetadataPublishStatus =
  'draft' | 'pending' | 'private' | 'publish' | 'scheduled';

/** Platform-neutral publishing metadata for a handoff package. */
export interface PublishingMetadata {
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

/** Warning attached to a publishing handoff package. */
export interface PublishingHandoffWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: 'warning' | 'error';
}

/** Summary of the review decision included in a handoff package. */
export interface PublishingReviewSummary {
  readonly reviewId: string;
  readonly status: ContentReviewStatus;
  readonly decision?: ContentReviewDecision;
  readonly reviewerId?: string;
  readonly findingCount: number;
  readonly notes?: string;
}

/** Publish-ready package derived from an approved artifact and review. */
export interface PublishingHandoffPackage {
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
  readonly target: PublishingTarget;
  readonly publishingMetadata: PublishingMetadata;
  readonly policySnapshot: GenerationPolicySnapshot;
  readonly reviewSummary: PublishingReviewSummary;
  readonly warnings: readonly PublishingHandoffWarning[];
  readonly status: PublishingHandoffStatus;
  readonly createdAt: string;
}

/** Input for creating a publishing handoff package. */
export interface PublishingHandoffRequest {
  readonly artifact: GeneratedContentArtifact;
  readonly review: ContentReviewResult;
  readonly target: PublishingTarget;
  readonly metadata: PublishingMetadata;
}

/** @deprecated Use PublishingHandoffRequest */
export type CreatePublishingHandoffInput = PublishingHandoffRequest;

/** Options for creating a publishing handoff package. */
export interface CreatePublishingHandoffOptions {
  readonly handoffIdGenerator?: (input: {
    artifactId: string;
    reviewId: string;
    targetId: string;
  }) => string;
  readonly createdAt?: string;
}

/** Result of validating a publishing handoff package. */
export interface PublishingValidationResult {
  readonly valid: boolean;
  readonly status: PublishingHandoffStatus;
  readonly errors: readonly PublishingHandoffWarning[];
  readonly warnings: readonly PublishingHandoffWarning[];
}

/** Result of creating a publishing handoff package. */
export interface CreatePublishingHandoffResult {
  readonly package: PublishingHandoffPackage;
  readonly validation: PublishingValidationResult;
}

/** Capability declaration for a publishing target adapter. */
export interface PublishingTargetCapabilities {
  readonly supportedFormats: readonly string[];
  readonly supportsDrafts: boolean;
  readonly supportsScheduling: boolean;
  readonly supportsFeaturedImage: boolean;
}

/** Result returned by a publishing target adapter publish call. */
export interface PublishingHandoffPublishResult {
  readonly success: boolean;
  readonly targetId: string;
  readonly externalId?: string;
  readonly url?: string;
  readonly publishedAt?: string;
  readonly message?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

/** Generic contract for publishing-target adapters such as WordPress. */
export interface PublishingTargetAdapter {
  readonly targetId: string;
  readonly capabilities: PublishingTargetCapabilities;
  validate(pkg: PublishingHandoffPackage): PublishingValidationResult;
  publish(pkg: PublishingHandoffPackage): Promise<PublishingHandoffPublishResult>;
}

/** @deprecated Import from @pcme/shared instead */
export type { ContentReviewResult, GeneratedContentArtifact } from '@pcme/shared';
