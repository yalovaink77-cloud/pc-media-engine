import { createHash } from 'node:crypto';

import type { ContentGenerationPlan } from '@pcme/content';

import {
  GenerationBlockedMetadataError,
  GenerationJobBlockedError,
  GenerationJobMissingPayloadError,
  GenerationUnsupportedOutputFormatError,
} from './errors.js';
import { buildPolicySnapshot } from './policy-snapshot.js';
import type { CreateGenerationJobOptions, GenerationJobRequest } from './types.js';
import { containsBlockedJobMetadata, estimateProviderNeutralPayloadSize } from './validate.js';

export const DEFAULT_SUPPORTED_OUTPUT_FORMATS = Object.freeze(['markdown', 'plain-text']);

export function buildDeterministicJobId(input: {
  requestId: string;
  sourceId: string;
  contentType: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

/** Convert a content generation plan into a provider-neutral generation job request. */
export function createGenerationJob(
  plan: ContentGenerationPlan,
  options?: CreateGenerationJobOptions,
): GenerationJobRequest {
  const supportedFormats = options?.supportedOutputFormats ?? DEFAULT_SUPPORTED_OUTPUT_FORMATS;

  if (plan.status === 'blocked') {
    throw new GenerationJobBlockedError({
      requestId: plan.requestId,
      blockReason: plan.blockReason,
    });
  }

  if (!plan.promptPayload) {
    throw new GenerationJobMissingPayloadError(plan.requestId);
  }

  if (!supportedFormats.includes(plan.outputFormat)) {
    throw new GenerationUnsupportedOutputFormatError(plan.outputFormat);
  }

  if (containsBlockedJobMetadata(plan.promptPayload)) {
    throw new GenerationBlockedMetadataError(plan.requestId);
  }

  const jobId = (options?.jobIdGenerator ?? ((input) => buildDeterministicJobId(input)))({
    requestId: plan.requestId,
    sourceId: plan.sourceReference.sourceId,
    contentType: plan.contentType,
  });

  const providerNeutralPayloadSize = estimateProviderNeutralPayloadSize(plan.promptPayload);

  return Object.freeze({
    jobId,
    requestId: plan.requestId,
    sourceId: plan.sourceReference.sourceId,
    snapshotId: plan.snapshot.snapshotId,
    contentType: plan.contentType,
    locale: plan.locale,
    tone: plan.tone,
    outputFormat: plan.outputFormat,
    promptPayload: plan.promptPayload,
    policySnapshot: buildPolicySnapshot(plan),
    metadata: Object.freeze({
      entityCount: plan.metadata.entityCount,
      promptSectionCount: plan.metadata.promptSectionCount,
      constraintCount: plan.metadata.constraintCount,
      estimatedInputCharacters: plan.metadata.estimatedInputCharacters,
      providerNeutralPayloadSize,
    }),
    createdAt: plan.createdAt,
    status: 'prepared',
  });
}
