import type {
  GeneratedContentArtifact,
  GeneratedContentStatus,
  GeneratedContentWarning,
} from '@pcme/shared';

export type {
  GeneratedContentArtifact,
  GeneratedContentFormat,
  GeneratedContentMetadata,
  GeneratedContentStatus,
  GeneratedContentWarning,
} from '@pcme/shared';

/** Result of validating generated content before artifact acceptance. */
export interface GeneratedContentValidationResult {
  readonly valid: boolean;
  readonly status: GeneratedContentStatus;
  readonly errors: readonly GeneratedContentWarning[];
  readonly warnings: readonly GeneratedContentWarning[];
}

/** Bounds and pattern options for generated content validation. */
export interface GeneratedContentValidationOptions {
  readonly minContentLength?: number;
  readonly maxContentLength?: number;
  readonly secretPatterns?: readonly RegExp[];
  readonly blockedMetadataPatterns?: readonly RegExp[];
  readonly absolutePathPatterns?: readonly RegExp[];
}

/** Options for creating a generated content artifact from a provider response. */
export interface CreateGeneratedContentArtifactOptions {
  readonly artifactIdGenerator?: (input: {
    jobId: string;
    requestId: string;
    providerId: string;
  }) => string;
  readonly validation?: GeneratedContentValidationOptions;
  readonly createdAt?: string;
}

/** Result of mapping a provider response into a generated content artifact. */
export interface CreateGeneratedContentArtifactResult {
  readonly artifact: GeneratedContentArtifact;
  readonly validation: GeneratedContentValidationResult;
}
