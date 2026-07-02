/**
 * StorageProvider — abstract interface for binary asset storage.
 *
 * Implementations:
 *   - LocalStorageProvider  (Sprint 6 — local filesystem, for development)
 *   - S3StorageProvider     (future — AWS S3 / compatible)
 *   - GcsStorageProvider    (future — Google Cloud Storage)
 *
 * The interface is intentionally minimal. The system never calls the provider
 * with stream-level primitives; callers hand a full Buffer and receive a full
 * Buffer. Streaming can be added as an optional extension later without
 * breaking this contract.
 *
 * storageKey lifecycle:
 *   1. The API creates an Asset record with a "placeholder" storageKey before
 *      the file is written (Pattern: {projectSlug}/{assetId}/{filename}).
 *   2. The StorageProvider.put() call writes the file and confirms the key.
 *   3. ProcessingArtifact.storageKey is null until the worker writes the
 *      artifact file, then set to the real key via finalise().
 *   4. getPublicUrl() converts a live storageKey to a URL for client access.
 */
export interface StorageProvider {
  /**
   * Write a file. If a file already exists at the key it is overwritten.
   * Returns the key that was used (same as the input key, confirmed).
   */
  put(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /** Read a file by key. Throws if the key does not exist. */
  get(key: string): Promise<Buffer>;

  /** Return true if the key exists. */
  exists(key: string): Promise<boolean>;

  /** Delete a file. No-op if the key does not exist. */
  delete(key: string): Promise<void>;

  /**
   * Return a URL for the client to access the file.
   * For local storage this is a server-relative path served by the API.
   * For S3 this is a signed URL or a public CDN URL.
   */
  getPublicUrl(key: string): string;

  /** Human-readable identifier for logging / config inspection. */
  readonly name: string;
}
