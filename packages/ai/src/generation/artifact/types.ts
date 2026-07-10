import type { GenerationPolicySnapshot, GenerationUsage } from '../types.js';

/** Lifecycle status for a generated content artifact. */
export type GeneratedContentStatus =
  'generated' | 'generated-with-warnings' | 'invalid' | 'rejected' | 'approved';

/** Supported output formats for generated content artifacts. */
export type GeneratedContentFormat = 'markdown' | 'plain-text' | (string & {});

/** Warning or validation issue attached to a generated content artifact. */
export interface GeneratedContentWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: 'warning' | 'error';
}

/** Metadata describing a generated content artifact without body text. */
export interface GeneratedContentMetadata {
  readonly contentType: string;
  readonly locale: string;
  readonly tone: string;
  readonly format: GeneratedContentFormat;
  readonly providerId: string;
  readonly model?: string;
  readonly finishReason?: string;
  readonly usage?: GenerationUsage;
}

/** Provider-neutral artifact representing validated AI generation output. */
export interface GeneratedContentArtifact {
  readonly artifactId: string;
  readonly jobId: string;
  readonly requestId: string;
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly providerId: string;
  readonly model?: string;
  readonly contentType: string;
  readonly locale: string;
  readonly tone: string;
  readonly format: GeneratedContentFormat;
  readonly content: string;
  readonly usage?: GenerationUsage;
  readonly finishReason?: string;
  readonly warnings: readonly GeneratedContentWarning[];
  readonly policySnapshot: GenerationPolicySnapshot;
  readonly status: GeneratedContentStatus;
  readonly createdAt: string;
}

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
