/**
 * Storage key utilities.
 *
 * A storageKey is the canonical identifier for a file in the storage layer.
 * It is stored in the database (Asset.storageKey, ProcessingArtifact.storageKey)
 * and passed directly to the StorageProvider.
 *
 * Key format:  {segment}/{segment}[/{segment}...] — no leading slash, no trailing
 * slash, no consecutive slashes, no parent-directory traversal.
 *
 * Canonical pattern used by this system:
 *   {projectSlug}/{assetId}/{filename}
 *   {projectSlug}/{assetId}/{processingType}-{artifactId}.{ext}
 */

/** Thrown when a key fails structural validation. */
export class StorageKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageKeyError';
  }
}

/** Thrown when a key exists in no file at the storage backend. */
export class StorageKeyNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`Storage key not found: ${key}`);
    this.name = 'StorageKeyNotFoundError';
  }
}

/**
 * Safe character set for key segments.
 * Allows alphanumeric, hyphen, underscore, dot, and forward slash.
 */
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9._\-/]+$/;

/**
 * Validate that a key is structurally sound.
 * Throws StorageKeyError with a descriptive message on violation.
 */
export function validateStorageKey(key: string): void {
  if (!key || key.trim() === '') {
    throw new StorageKeyError('Storage key must not be empty');
  }
  if (key.startsWith('/')) {
    throw new StorageKeyError(`Storage key must not start with '/': ${key}`);
  }
  if (key.endsWith('/')) {
    throw new StorageKeyError(`Storage key must not end with '/': ${key}`);
  }
  if (key.includes('..')) {
    throw new StorageKeyError(`Storage key must not contain '..': ${key}`);
  }
  if (key.includes('//')) {
    throw new StorageKeyError(`Storage key must not contain consecutive slashes: ${key}`);
  }
  if (!SAFE_KEY_PATTERN.test(key)) {
    throw new StorageKeyError(
      `Storage key contains invalid characters (allowed: a-z A-Z 0-9 . _ - /): ${key}`,
    );
  }
}

/**
 * Normalise a raw key string:
 *   - Replace backslashes with forward slashes
 *   - Strip leading and trailing slashes
 *   - Collapse consecutive slashes
 *
 * Does NOT validate — call validateStorageKey after normalising if needed.
 */
export function normalizeKey(key: string): string {
  return key.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/');
}

/**
 * Build a canonical storageKey from its three components.
 *
 * Sanitises the filename segment so that spaces and characters outside the
 * safe set are replaced with underscores. The projectSlug and assetId are
 * used as-is; callers are expected to provide valid slugs.
 */
export function buildStorageKey(projectSlug: string, assetId: string, filename: string): string {
  const safeFilename = filename
    .replace(/\\/g, '/')
    .replace(/[^a-zA-Z0-9._\-/]/g, '_')
    .replace(/^\/+/, '');

  const key = `${projectSlug}/${assetId}/${safeFilename}`;
  validateStorageKey(key);
  return key;
}
