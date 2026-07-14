import type { GeneratedContentArtifact } from '@pcme/shared';

export const DEFAULT_MAX_REVISION_COUNT = 2;

export function resolveRevisionNumber(artifact: GeneratedContentArtifact): number {
  return artifact.revisionNumber ?? 1;
}

export function resolveRootArtifactId(artifact: GeneratedContentArtifact): string {
  return artifact.rootArtifactId ?? artifact.artifactId;
}

export function assertRevisionCountWithinLimit(
  priorArtifact: GeneratedContentArtifact,
  maxRevisionCount = DEFAULT_MAX_REVISION_COUNT,
): void {
  const nextRevisionNumber = resolveRevisionNumber(priorArtifact) + 1;
  if (nextRevisionNumber > maxRevisionCount) {
    throw new Error(
      `Revision count limit reached: next revision ${nextRevisionNumber} exceeds maximum ${maxRevisionCount}`,
    );
  }
}

export function buildRevisionArtifactLineage(input: {
  priorArtifact: GeneratedContentArtifact;
  revisionRequestId: string;
}): {
  readonly revisionNumber: number;
  readonly rootArtifactId: string;
  readonly parentArtifactId: string;
  readonly revisionRequestId: string;
} {
  const revisionNumber = resolveRevisionNumber(input.priorArtifact) + 1;
  return Object.freeze({
    revisionNumber,
    rootArtifactId: resolveRootArtifactId(input.priorArtifact),
    parentArtifactId: input.priorArtifact.artifactId,
    revisionRequestId: input.revisionRequestId,
  });
}
