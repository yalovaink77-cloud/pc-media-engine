import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { LocalStorageConfig } from './config.js';
import { StorageKeyError, StorageKeyNotFoundError, validateStorageKey } from './key.js';
import type { StorageMeta, StorageProvider } from './provider.js';

export type { LocalStorageConfig } from './config.js';

/**
 * LocalStorageProvider — stores files on the local filesystem.
 *
 * Intended for local development and integration tests only.
 * Each storageKey is treated as a relative path inside rootDir.
 *
 * Security: keys are validated on every call. Keys containing '..'
 * or starting with '/' are rejected before any filesystem access.
 *
 * Concurrency: no locking. Simultaneous writes to the same key produce
 * last-writer-wins semantics from the OS. Acceptable for development;
 * production providers implement their own consistency guarantees.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  private readonly rootDir: string;
  private readonly baseUrl: string;

  constructor(config: LocalStorageConfig) {
    this.rootDir = resolve(config.rootDir);
    this.baseUrl = (config.baseUrl ?? '/files').replace(/\/$/, '');
  }

  async put(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const filePath = this.resolveSafe(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const filePath = this.resolveSafe(key);
    try {
      return await readFile(filePath);
    } catch (err) {
      if (isNoEnt(err)) throw new StorageKeyNotFoundError(key);
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafe(key);
      await stat(filePath);
      return true;
    } catch (err) {
      if (err instanceof StorageKeyError) throw err;
      return false;
    }
  }

  async stat(key: string): Promise<StorageMeta> {
    const filePath = this.resolveSafe(key);
    try {
      const s = await stat(filePath);
      return {
        key,
        sizeBytes: s.size,
        lastModified: s.mtime,
      };
    } catch (err) {
      if (isNoEnt(err)) throw new StorageKeyNotFoundError(key);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafe(key);
    try {
      await unlink(filePath);
    } catch (err) {
      if (isNoEnt(err)) return;
      throw err;
    }
  }

  getPublicUrl(key: string): string {
    this.resolveSafe(key);
    return `${this.baseUrl}/${key}`;
  }

  /**
   * Resolve a storageKey to an absolute filesystem path.
   * Validates the key and guards against path traversal.
   * Throws StorageKeyError on any violation — never performs I/O.
   */
  private resolveSafe(key: string): string {
    validateStorageKey(key);

    const abs = join(this.rootDir, key);

    if (!abs.startsWith(this.rootDir + '/') && abs !== this.rootDir) {
      throw new StorageKeyError(`Path traversal rejected for key: ${key}`);
    }

    return abs;
  }
}

function isNoEnt(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
