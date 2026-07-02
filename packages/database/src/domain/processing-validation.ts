/**
 * Processing-domain validation helpers.
 * Describe intent and declared outputs — no execution, no file I/O.
 */

import type { ArtifactType, ProcessingType } from '@prisma/client';

export class ProcessingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessingValidationError';
  }
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/** Allowed priority range: 0 (lowest) – 100 (highest). */
export const PRIORITY_MIN = 0;
export const PRIORITY_MAX = 100;

export function validatePriority(priority: number): void {
  if (!Number.isInteger(priority) || priority < PRIORITY_MIN || priority > PRIORITY_MAX) {
    throw new ProcessingValidationError(
      `Priority must be an integer between ${PRIORITY_MIN} and ${PRIORITY_MAX}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Retry count
// ---------------------------------------------------------------------------

export function validateRetryCount(retryCount: number): void {
  if (!Number.isInteger(retryCount) || retryCount < 0) {
    throw new ProcessingValidationError('retryCount must be a non-negative integer');
  }
}

// ---------------------------------------------------------------------------
// MIME type (artifact outputs)
// ---------------------------------------------------------------------------

const MIME_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;

export function validateArtifactMimeType(mimeType: string): void {
  if (!MIME_TYPE_PATTERN.test(mimeType.trim())) {
    throw new ProcessingValidationError(`Invalid artifact MIME type: ${mimeType}`);
  }
}

// ---------------------------------------------------------------------------
// Storage key placeholder
// ---------------------------------------------------------------------------

/**
 * Placeholder follows the same segment structure as the real storage key
 * defined in storage-strategy.md: {projectSlug}/{assetId}/{filename}.
 * Only the shape is validated; no file system or provider call is made.
 */
const STORAGE_KEY_PLACEHOLDER_PATTERN = /^[a-z0-9][a-z0-9._/-]*\/[a-z0-9]+\/[a-z0-9][a-z0-9._-]*$/i;

export function validateStorageKeyPlaceholder(placeholder: string): void {
  if (!STORAGE_KEY_PLACEHOLDER_PATTERN.test(placeholder.trim())) {
    throw new ProcessingValidationError(
      'Storage key placeholder must follow {projectSlug}/{assetId}/{filename} with safe path segments',
    );
  }
}

// ---------------------------------------------------------------------------
// Artifact type × processing type compatibility
// ---------------------------------------------------------------------------

/**
 * Documents which artifact types are plausibly produced by each processing
 * type. Enforced at record-creation time so obviously wrong combinations
 * are caught early without coupling to any engine.
 */
const COMPATIBLE_ARTIFACTS: Record<ProcessingType, ArtifactType[]> = {
  metadata_extract: ['metadata'],
  thumbnail: ['thumbnail'],
  waveform: ['waveform'],
  transcript: ['transcript'],
  preview: ['preview'],
  ai_analysis: ['metadata', 'transcript'],
};

export function validateArtifactCompatibility(
  processingType: ProcessingType,
  artifactType: ArtifactType,
): void {
  const allowed = COMPATIBLE_ARTIFACTS[processingType];

  if (!allowed.includes(artifactType)) {
    throw new ProcessingValidationError(
      `Artifact type "${artifactType}" is not compatible with processing type "${processingType}". ` +
        `Allowed: ${allowed.join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Checksum (reuses sha-256 shape — no algorithm abstraction needed here)
// ---------------------------------------------------------------------------

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export function validateArtifactChecksum(checksum: string): void {
  if (!SHA256_HEX_PATTERN.test(checksum.toLowerCase())) {
    throw new ProcessingValidationError(
      'Artifact checksum must be a lowercase SHA-256 hex digest (64 characters)',
    );
  }
}
