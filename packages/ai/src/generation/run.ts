import {
  GenerationJobBlockedError,
  GenerationProviderExecutionError,
  GenerationUnsupportedOutputFormatError,
} from './errors.js';
import type {
  GenerationJobRequest,
  GenerationJobResult,
  GenerationProviderAdapter,
  GenerationProviderRequest,
} from './types.js';
import { estimateProviderNeutralPayloadSize } from './validate.js';

/** Execute a prepared generation job through a provider adapter. */
export async function runGenerationJob(
  job: GenerationJobRequest,
  provider: GenerationProviderAdapter,
): Promise<GenerationJobResult> {
  if (job.status === 'blocked') {
    throw new GenerationJobBlockedError({
      requestId: job.requestId,
      blockReason: 'Job is blocked',
    });
  }

  if (!provider.capabilities.supportedOutputFormats.includes(job.outputFormat)) {
    throw new GenerationUnsupportedOutputFormatError(job.outputFormat);
  }

  const request: GenerationProviderRequest = Object.freeze({ job });
  const response = await provider.generate(request);
  const completedAt = new Date().toISOString();

  if (response.status === 'failed') {
    return Object.freeze({
      jobId: job.jobId,
      requestId: job.requestId,
      status: 'failed',
      providerId: response.providerId,
      response,
      error: response.error,
      completedAt,
    });
  }

  return Object.freeze({
    jobId: job.jobId,
    requestId: job.requestId,
    status: 'succeeded',
    providerId: response.providerId,
    response,
    completedAt,
  });
}

export { GenerationJobBlockedError, GenerationUnsupportedOutputFormatError } from './errors.js';

export function buildProviderUsage(job: GenerationJobRequest) {
  return Object.freeze({
    inputCharacters:
      job.metadata.providerNeutralPayloadSize ||
      estimateProviderNeutralPayloadSize(job.promptPayload),
    outputCharacters: 0,
  });
}

export function toProviderExecutionError(
  providerId: string,
  error: GenerationErrorLike,
): GenerationProviderExecutionError {
  return new GenerationProviderExecutionError({
    providerId,
    code: error.code,
    message: error.message,
  });
}

interface GenerationErrorLike {
  readonly code: string;
  readonly message: string;
}
