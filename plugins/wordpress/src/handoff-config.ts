import type { WordPressConfig } from './config.js';
import { loadWordPressConfig } from './config.js';

/** WordPress post status values supported by the handoff adapter. */
export type WordPressHandoffPostStatus = 'draft' | 'pending' | 'private' | 'publish' | 'future';

/** Extended configuration for the WordPress publishing handoff adapter. */
export interface WordPressHandoffAdapterConfig extends WordPressConfig {
  readonly defaultAuthor?: string;
  readonly defaultStatus?: WordPressHandoffPostStatus;
}

export function loadWordPressHandoffAdapterConfig(
  env: Record<string, string | undefined> = process.env,
): WordPressHandoffAdapterConfig {
  const base = loadWordPressConfig(env);
  const defaultAuthor = env['WORDPRESS_DEFAULT_AUTHOR']?.trim();
  const defaultStatus = env['WORDPRESS_DEFAULT_STATUS']?.trim() as
    WordPressHandoffPostStatus | undefined;

  return Object.freeze({
    ...base,
    defaultAuthor: defaultAuthor || undefined,
    defaultStatus: defaultStatus || 'draft',
  });
}

export function hasWordPressHandoffCredentials(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const url = (env['WORDPRESS_URL'] ?? env['WORDPRESS_BASE_URL'] ?? '').trim();
  const username = (env['WORDPRESS_USERNAME'] ?? '').trim();
  const appPassword = (env['WORDPRESS_APP_PASSWORD'] ?? '').trim();
  return Boolean(url && username && appPassword);
}
