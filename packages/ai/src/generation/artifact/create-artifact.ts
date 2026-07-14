import { createHash } from 'node:crypto';

import type { GenerationJobRequest, GenerationProviderResponse } from '../types.js';
import type {
  CreateGeneratedContentArtifactOptions,
  CreateGeneratedContentArtifactResult,
  GeneratedContentArtifact,
  GeneratedContentFormat,
  GeneratedContentWarning,
} from './types.js';
import { validateGeneratedContent } from './validate.js';

export function buildDeterministicArtifactId(input: {
  jobId: string;
  requestId: string;
  providerId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

function buildArtifactWarnings(
  validationWarnings: readonly GeneratedContentWarning[],
): readonly GeneratedContentWarning[] {
  return Object.freeze(validationWarnings.map((warning) => Object.freeze({ ...warning })));
}

/** Map a generation job and provider response into a validated content artifact. */
export function createGeneratedContentArtifact(
  job: GenerationJobRequest,
  providerResponse: GenerationProviderResponse,
  options?: CreateGeneratedContentArtifactOptions,
): CreateGeneratedContentArtifactResult {
  const providerId = providerResponse.providerId;
  const artifactId = (options?.artifactIdGenerator ?? buildDeterministicArtifactId)({
    jobId: job.jobId,
    requestId: job.requestId,
    providerId,
  });

  const content = providerResponse.content ?? '';
  const format = job.outputFormat as GeneratedContentFormat;
  const validation = validateGeneratedContent({
    job,
    providerResponse,
    content,
    format,
    options: options?.validation,
  });

  const artifact: GeneratedContentArtifact = Object.freeze({
    artifactId,
    revisionNumber: options?.lineage?.revisionNumber ?? 1,
    rootArtifactId: options?.lineage?.rootArtifactId ?? artifactId,
    parentArtifactId: options?.lineage?.parentArtifactId,
    revisionRequestId: options?.lineage?.revisionRequestId,
    jobId: job.jobId,
    requestId: job.requestId,
    sourceId: job.sourceId,
    snapshotId: job.snapshotId,
    providerId,
    model: providerResponse.model,
    contentType: job.contentType,
    locale: job.locale,
    tone: job.tone,
    format,
    content,
    usage: providerResponse.usage ? Object.freeze({ ...providerResponse.usage }) : undefined,
    finishReason: providerResponse.finishReason,
    warnings: buildArtifactWarnings(validation.warnings),
    policySnapshot: job.policySnapshot,
    status: validation.status,
    createdAt: options?.createdAt ?? new Date().toISOString(),
  });

  return Object.freeze({
    artifact,
    validation,
  });
}
