/**
 * StorageProvider — abstract interface for binary asset storage.
 *
 * Implementations:
 *   - LocalStorageProvider  (development — local filesystem)
 *   - S3StorageProvider     (future — AWS S3 / compatible)
 *   - GcsStorageProvider    (future — Google Cloud Storage)
 *
 * The interface is intentionally minimal. The system never calls the
 * provider with stream-level primitives; callers hand a full Buffer and
 * receive a full Buffer. Streaming can be added as an optional extension
 * later without breaking this contract.
 *
 * storageKey lifecycle:
 *   1. The API creates an Asset record with a storageKey before the file
 *      is written (pattern: {projectSlug}/{assetId}/{filename}).
 *   2. StorageProvider.put() writes the file and confirms the key.
 *   3. ProcessingArtifact.storageKey is null until the worker writes the
 *      artifact file, then set via ProcessingArtifactRepository.finalise().
 *   4. getPublicUrl() converts a live storageKey to a URL for client access.
 */

/** Metadata returned by StorageProvider.stat(). */
export type StorageMeta = {
  /** The canonical storage key. */
  key: string;
  /** Size of the stored file in bytes. */
  sizeBytes: number;
  /** When the file was last written. */
  lastModified: Date;
};

export interface StorageProvider {
  /**
   * Write a file. If a file already exists at the key it is overwritten.
   * Returns the key that was used (same as the input key, confirmed).
   */
  put(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Read a file by key.
   * Throws StorageKeyNotFoundError if the key does not exist.
   */
  get(key: string): Promise<Buffer>;

  /** Return true if the key exists. */
  exists(key: string): Promise<boolean>;

  /**
   * Return metadata for the stored file.
   * Throws StorageKeyNotFoundError if the key does not exist.
   */
  stat(key: string): Promise<StorageMeta>;

  /** Delete a file. No-op if the key does not exist. */
  delete(key: string): Promise<void>;

  /**
   * Return a URL for the client to access the file.
   * For local storage this is a server-relative path served by the API.
   * For S3 this is a public CDN URL (signed URLs are not part of this interface).
   */
  getPublicUrl(key: string): string;

  /** Human-readable identifier for logging / config inspection. */
  readonly name: string;
}
