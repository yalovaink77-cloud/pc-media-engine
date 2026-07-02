import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { StorageProvider } from './provider.js';

export type LocalStorageConfig = {
  /**
   * Absolute path to the root directory where files are stored.
   * Created automatically if it does not exist.
   */
  rootDir: string;

  /**
   * Base URL prepended to keys when building public URLs.
   * Defaults to '/files' (the API serves files at that prefix).
   * Example: 'http://localhost:3000/files'
   */
  baseUrl?: string;
};

/**
 * LocalStorageProvider — stores files on the local filesystem.
 *
 * Intended for local development and integration tests only.
 * All keys are treated as relative paths inside rootDir.
 * Path traversal (keys containing '..') is rejected.
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
    return readFile(filePath);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafe(key);
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.resolveSafe(key);
      await unlink(filePath);
    } catch {
      // No-op if not found
    }
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  private resolveSafe(key: string): string {
    const normalised = key.replace(/\\/g, '/').replace(/^\/+/, '');

    if (normalised.includes('..')) {
      throw new Error(`Path traversal rejected for key: ${key}`);
    }

    return join(this.rootDir, normalised);
  }
}
