/**
 * @pcme/provider-storage-local
 *
 * Re-exports the LocalStorageProvider and related types from @pcme/media.
 *
 * This package follows the same layout as other providers in
 * providers/storage/* so that consumer code can swap providers by changing
 * a single import path. The implementation lives in @pcme/media because
 * Sprint 7 tests and the smoke script both run under that package filter.
 *
 * Usage:
 *   import { LocalStorageProvider } from '@pcme/provider-storage-local';
 */
export type { LocalStorageConfig } from '@pcme/media';
export type { StorageMeta, StorageProvider } from '@pcme/media';
export { LocalStorageProvider, StorageKeyError, StorageKeyNotFoundError } from '@pcme/media';
