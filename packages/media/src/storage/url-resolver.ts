import type { StorageProvider } from './provider.js';

/**
 * MediaUrlResolver — converts storage keys to public URLs.
 *
 * Wraps the StorageProvider so callers don't need to depend on
 * the full provider interface just to resolve a URL. This is the
 * boundary that the rest of the system should cross when it needs
 * a URL for a stored asset or artifact.
 */
export class MediaUrlResolver {
  constructor(private readonly provider: StorageProvider) {}

  /**
   * Resolve the public URL for an asset storageKey.
   * Returns null if the key is empty/null.
   */
  resolve(storageKey: string | null | undefined): string | null {
    if (!storageKey) return null;
    return this.provider.getPublicUrl(storageKey);
  }

  /**
   * Resolve URLs for multiple keys at once.
   * Keys that are null/undefined produce a null entry.
   */
  resolveMany(keys: (string | null | undefined)[]): (string | null)[] {
    return keys.map((k) => this.resolve(k));
  }
}
