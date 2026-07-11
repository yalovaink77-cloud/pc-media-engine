import { GenerationJobError } from '../errors.js';

/** Base error for generated content artifact failures. */
export class GeneratedContentArtifactError extends GenerationJobError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GeneratedContentArtifactError';
  }
}

/** Thrown when an artifact cannot be found in the store. */
export class GeneratedContentArtifactNotFoundError extends GeneratedContentArtifactError {
  readonly artifactId: string;

  constructor(artifactId: string) {
    super(`Generated content artifact not found: ${artifactId}`);
    this.name = 'GeneratedContentArtifactNotFoundError';
    this.artifactId = artifactId;
  }
}

/** Thrown when attempting to mutate or overwrite an existing artifact. */
export class GeneratedContentArtifactImmutableError extends GeneratedContentArtifactError {
  readonly artifactId: string;

  constructor(artifactId: string) {
    super(`Generated content artifact is immutable: ${artifactId}`);
    this.name = 'GeneratedContentArtifactImmutableError';
    this.artifactId = artifactId;
  }
}

/** Thrown when an artifact status transition is not allowed. */
export class GeneratedContentArtifactTransitionError extends GeneratedContentArtifactError {
  readonly artifactId: string;
  readonly fromStatus: string;
  readonly toStatus: string;

  constructor(options: { artifactId: string; fromStatus: string; toStatus: string }) {
    super(
      `Cannot transition generated content artifact ${options.artifactId} from ${options.fromStatus} to ${options.toStatus}`,
    );
    this.name = 'GeneratedContentArtifactTransitionError';
    this.artifactId = options.artifactId;
    this.fromStatus = options.fromStatus;
    this.toStatus = options.toStatus;
  }
}
