import {
  GeneratedContentArtifactImmutableError,
  GeneratedContentArtifactNotFoundError,
  GeneratedContentArtifactTransitionError,
} from './errors.js';
import type { GeneratedContentArtifact, GeneratedContentStatus } from './types.js';

const APPROVABLE_STATUSES = new Set<GeneratedContentStatus>([
  'generated',
  'generated-with-warnings',
]);
const REJECTABLE_STATUSES = new Set<GeneratedContentStatus>([
  'generated',
  'generated-with-warnings',
  'invalid',
]);

function cloneWithStatus(
  artifact: GeneratedContentArtifact,
  status: GeneratedContentStatus,
): GeneratedContentArtifact {
  return Object.freeze({
    ...artifact,
    status,
    warnings: Object.freeze([...artifact.warnings]),
    usage: artifact.usage ? Object.freeze({ ...artifact.usage }) : undefined,
    policySnapshot: Object.freeze({
      ...artifact.policySnapshot,
      safetyConstraints: Object.freeze([...artifact.policySnapshot.safetyConstraints]),
      affiliateConstraints: Object.freeze([...artifact.policySnapshot.affiliateConstraints]),
      citationRequirements: Object.freeze([...artifact.policySnapshot.citationRequirements]),
      blockedFields: Object.freeze([...artifact.policySnapshot.blockedFields]),
    }),
  });
}

/** In-memory artifact store for tests and offline development only. */
export class InMemoryGeneratedContentArtifactStore {
  private readonly artifacts = new Map<string, GeneratedContentArtifact>();

  save(artifact: GeneratedContentArtifact): void {
    if (this.artifacts.has(artifact.artifactId)) {
      throw new GeneratedContentArtifactImmutableError(artifact.artifactId);
    }

    this.artifacts.set(artifact.artifactId, cloneWithStatus(artifact, artifact.status));
  }

  getById(artifactId: string): GeneratedContentArtifact | undefined {
    const artifact = this.artifacts.get(artifactId);
    return artifact ? cloneWithStatus(artifact, artifact.status) : undefined;
  }

  listByJobId(jobId: string): readonly GeneratedContentArtifact[] {
    return Object.freeze(
      [...this.artifacts.values()]
        .filter((artifact) => artifact.jobId === jobId)
        .map((artifact) => cloneWithStatus(artifact, artifact.status)),
    );
  }

  reject(artifactId: string): GeneratedContentArtifact {
    const artifact = this.requireArtifact(artifactId);
    if (!REJECTABLE_STATUSES.has(artifact.status)) {
      throw new GeneratedContentArtifactTransitionError({
        artifactId,
        fromStatus: artifact.status,
        toStatus: 'rejected',
      });
    }

    const rejected = cloneWithStatus(artifact, 'rejected');
    this.artifacts.set(artifactId, rejected);
    return rejected;
  }

  approve(artifactId: string): GeneratedContentArtifact {
    const artifact = this.requireArtifact(artifactId);
    if (!APPROVABLE_STATUSES.has(artifact.status)) {
      throw new GeneratedContentArtifactTransitionError({
        artifactId,
        fromStatus: artifact.status,
        toStatus: 'approved',
      });
    }

    const approved = cloneWithStatus(artifact, 'approved');
    this.artifacts.set(artifactId, approved);
    return approved;
  }

  private requireArtifact(artifactId: string): GeneratedContentArtifact {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      throw new GeneratedContentArtifactNotFoundError(artifactId);
    }
    return artifact;
  }
}
