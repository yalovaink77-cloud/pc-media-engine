/**
 * Metadata-domain validation helpers.
 * Describe facts about media records — no upload or processing logic.
 */

export const SUPPORTED_CHECKSUM_ALGORITHMS = ['sha256'] as const;

export type ChecksumAlgorithm = (typeof SUPPORTED_CHECKSUM_ALGORITHMS)[number];

/** Lowercase hex SHA-256 digest (64 chars). */
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Storage key segment: project slug / asset id / sanitized filename.
 * Provider-agnostic placeholder aligned with storage-strategy.md.
 */
export const STORAGE_KEY_PATTERN = /^[a-z0-9][a-z0-9._/-]*\/[a-z0-9]+\/[a-z0-9][a-z0-9._-]*$/i;

const MIME_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;

const METADATA_NAMESPACE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const METADATA_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,127}$/;

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaValidationError';
  }
}

export function validateMimeType(mimeType: string): void {
  const normalized = mimeType.trim().toLowerCase();
  if (!MIME_TYPE_PATTERN.test(normalized)) {
    throw new MediaValidationError(`Invalid MIME type: ${mimeType}`);
  }
}

export function validateChecksumAlgorithm(
  algorithm: string,
): asserts algorithm is ChecksumAlgorithm {
  if (!SUPPORTED_CHECKSUM_ALGORITHMS.includes(algorithm as ChecksumAlgorithm)) {
    throw new MediaValidationError(`Unsupported checksum algorithm: ${algorithm}`);
  }
}

export function validateSha256Checksum(checksum: string): void {
  if (!SHA256_HEX_PATTERN.test(checksum.toLowerCase())) {
    throw new MediaValidationError(
      'Checksum must be a lowercase SHA-256 hex digest (64 characters)',
    );
  }
}

export function validateChecksum(checksum: string, algorithm: string): void {
  validateChecksumAlgorithm(algorithm);
  if (algorithm === 'sha256') {
    validateSha256Checksum(checksum);
  }
}

export function validateStorageKey(storageKey: string): void {
  const normalized = storageKey.trim();
  if (!STORAGE_KEY_PATTERN.test(normalized)) {
    throw new MediaValidationError(
      'Storage key must follow {projectSlug}/{assetId}/{filename} with safe path segments',
    );
  }
}

export function validateMetadataNamespace(namespace: string): void {
  if (!METADATA_NAMESPACE_PATTERN.test(namespace)) {
    throw new MediaValidationError(
      'Metadata namespace must start with a letter and use lowercase letters, digits, underscores, or hyphens',
    );
  }
}

export function validateMetadataKey(key: string): void {
  if (!METADATA_KEY_PATTERN.test(key)) {
    throw new MediaValidationError(
      'Metadata key must start with a letter and use lowercase letters, digits, underscores, or hyphens',
    );
  }
}

/** Sanitize a filename for storage key segments (not full path resolution). */
export function sanitizeFilenameForStorageKey(filename: string): string {
  const base = filename.trim().replace(/[/\\]/g, '-');
  const sanitized = base
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!sanitized) {
    throw new MediaValidationError('Filename cannot be empty after sanitization');
  }

  return sanitized.toLowerCase();
}

/** Build a provider-agnostic storage key placeholder (no binary upload). */
export function buildStorageKeyPlaceholder(
  projectSlug: string,
  assetId: string,
  originalFilename: string,
): string {
  const slug = projectSlug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new MediaValidationError(
      'Project slug must be lowercase alphanumeric with optional hyphens',
    );
  }

  const id = assetId.trim();
  if (!/^[a-z0-9]+$/i.test(id)) {
    throw new MediaValidationError('Asset id must be alphanumeric');
  }

  const filename = sanitizeFilenameForStorageKey(originalFilename);
  const key = `${slug}/${id}/${filename}`;
  validateStorageKey(key);
  return key;
}
