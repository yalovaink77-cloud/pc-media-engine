import type { ContentRevisionRequest, GeneratedContentArtifact } from '@pcme/shared';

import { createGeneratedContentArtifact } from '../artifact/create-artifact.js';
import type { CreateGeneratedContentArtifactOptions } from '../artifact/types.js';
import type { GenerationJobRequest, GenerationProviderResponse } from '../types.js';
import { buildDeterministicRevisionArtifactId } from './ids.js';
import { buildRevisionArtifactLineage } from './lineage.js';

export interface CreateRevisionArtifactInput {
  readonly job: GenerationJobRequest;
  readonly priorArtifact: GeneratedContentArtifact;
  readonly revisionRequest: ContentRevisionRequest;
  readonly providerResponse: GenerationProviderResponse;
  readonly options?: CreateGeneratedContentArtifactOptions;
}

/** Create a new immutable revision artifact linked to its parent draft. */
export function createRevisionArtifact(
  input: CreateRevisionArtifactInput,
): GeneratedContentArtifact {
  const lineage = buildRevisionArtifactLineage({
    priorArtifact: input.priorArtifact,
    revisionRequestId: input.revisionRequest.revisionRequestId,
  });

  const { artifact } = createGeneratedContentArtifact(input.job, input.providerResponse, {
    ...input.options,
    artifactIdGenerator: () =>
      buildDeterministicRevisionArtifactId({
        jobId: input.job.jobId,
        requestId: input.job.requestId,
        providerId: input.providerResponse.providerId,
        revisionRequestId: input.revisionRequest.revisionRequestId,
        revisionNumber: lineage.revisionNumber,
      }),
  });

  return Object.freeze({
    ...artifact,
    revisionNumber: lineage.revisionNumber,
    rootArtifactId: lineage.rootArtifactId,
    parentArtifactId: lineage.parentArtifactId,
    revisionRequestId: lineage.revisionRequestId,
  });
}
