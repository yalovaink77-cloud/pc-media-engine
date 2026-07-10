import type { PromptPayloadResult } from '@pcme/content';
import type { GenerationPolicySnapshot, GenerationUsage } from '@pcme/shared';

export type { GenerationPolicySnapshot, GenerationUsage } from '@pcme/shared';

/** Lifecycle status for a generation job. */
export type GenerationJobStatus =
  'prepared' | 'running' | 'succeeded' | 'failed' | 'blocked' | 'cancelled';

/** Metadata describing a prepared generation job. */
export interface GenerationJobMetadata {
  readonly entityCount: number;
  readonly promptSectionCount: number;
  readonly constraintCount: number;
  readonly estimatedInputCharacters: number;
  readonly providerNeutralPayloadSize: number;
}

/** Provider-neutral generation job request derived from a content plan. */
export interface GenerationJobRequest {
  readonly jobId: string;
  readonly requestId: string;
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly tone: string;
  readonly outputFormat: string;
  readonly promptPayload: PromptPayloadResult;
  readonly policySnapshot: GenerationPolicySnapshot;
  readonly metadata: GenerationJobMetadata;
  readonly createdAt: string;
  readonly status: GenerationJobStatus;
}

/** Request passed to a generation provider adapter. */
export interface GenerationProviderRequest {
  readonly job: GenerationJobRequest;
}

/** Typed error codes returned by generation provider adapters. */
export type GenerationProviderErrorCode =
  | 'authentication'
  | 'rate-limit'
  | 'timeout'
  | 'invalid-request'
  | 'provider-unavailable'
  | 'malformed-response'
  | 'cancelled';

/** Structured provider failure information. */
export interface GenerationError {
  readonly code: string;
  readonly message: string;
  readonly retryable?: boolean;
}

/** Redacted diagnostics safe for logs and error surfaces. */
export interface GenerationProviderDiagnostics {
  readonly httpStatus?: number;
  readonly providerModel?: string;
  readonly finishReason?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly elapsedMs?: number;
  readonly detail?: string;
}

/** Response returned by a generation provider adapter. */
export interface GenerationProviderResponse {
  readonly providerId: string;
  readonly status: 'succeeded' | 'failed';
  readonly jobId?: string;
  readonly requestId?: string;
  readonly model?: string;
  readonly finishReason?: string;
  readonly content?: string;
  readonly usage?: GenerationUsage;
  readonly warnings?: readonly string[];
  readonly diagnostics?: GenerationProviderDiagnostics;
  readonly error?: GenerationError;
}

/** Result of executing a generation job through a provider. */
export interface GenerationJobResult {
  readonly jobId: string;
  readonly requestId: string;
  readonly status: GenerationJobStatus;
  readonly providerId?: string;
  readonly response?: GenerationProviderResponse;
  readonly error?: GenerationError;
  readonly completedAt?: string;
}

/** Capability declaration for a generation provider adapter. */
export interface GenerationProviderCapabilities {
  readonly supportedOutputFormats: readonly string[];
  readonly supportsStreaming?: boolean;
  readonly maxInputCharacters?: number;
}

/** Generic contract between orchestrator jobs and AI providers. */
export interface GenerationProviderAdapter {
  readonly providerId: string;
  readonly capabilities: GenerationProviderCapabilities;
  generate(request: GenerationProviderRequest): Promise<GenerationProviderResponse>;
}

/** Options for creating a generation job from a content plan. */
export interface CreateGenerationJobOptions {
  readonly jobIdGenerator?: (input: {
    requestId: string;
    sourceId: string;
    contentType: string;
  }) => string;
  readonly supportedOutputFormats?: readonly string[];
}
