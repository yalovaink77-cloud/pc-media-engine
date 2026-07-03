/**
 * Storage configuration.
 *
 * LocalStorageConfig is consumed by LocalStorageProvider.
 * loadLocalStorageConfig() reads from environment variables so that
 * application entry-points don't need to build config themselves.
 *
 * Environment variables:
 *   STORAGE_LOCAL_ROOT   — absolute path to the file storage root directory (required)
 *   STORAGE_BASE_URL     — base URL prefix for public file access (optional, default: /files)
 */
export type LocalStorageConfig = {
  /**
   * Absolute path to the root directory where files are stored.
   * The directory is created automatically if it does not exist.
   */
  rootDir: string;

  /**
   * Base URL prepended to keys when building public URLs.
   * Defaults to '/files'. Set to a full origin for development
   * (e.g. 'http://localhost:3000/files').
   */
  baseUrl?: string;
};

/**
 * Read LocalStorageConfig from environment variables.
 * Throws if required variables are absent.
 */
export function loadLocalStorageConfig(): LocalStorageConfig {
  const rootDir = process.env['STORAGE_LOCAL_ROOT'];
  if (!rootDir) {
    throw new Error('STORAGE_LOCAL_ROOT environment variable is required for LocalStorageProvider');
  }
  return {
    rootDir,
    baseUrl: process.env['STORAGE_BASE_URL'] ?? '/files',
  };
}
