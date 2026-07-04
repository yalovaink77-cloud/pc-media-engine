/**
 * WordPress plugin configuration.
 *
 * Required environment variables:
 *   WORDPRESS_BASE_URL      — e.g. https://example.com (no trailing slash)
 *   WORDPRESS_USERNAME      — WordPress username
 *   WORDPRESS_APP_PASSWORD  — WordPress Application Password (see README)
 *
 * Generate an Application Password:
 *   WordPress Admin → Users → Your Profile → Application Passwords
 *   Give it a name (e.g. "PC Media Engine") and copy the generated password.
 *   The password is typically 24 characters with spaces; spaces are stripped
 *   when sent in the Authorization header.
 */

export type WordPressConfig = {
  /** Full site URL, e.g. https://example.com. Trailing slash is stripped. */
  baseUrl: string;
  /** WordPress username. */
  username: string;
  /** WordPress Application Password (not your login password). */
  appPassword: string;
};

export class WordPressConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordPressConfigError';
  }
}

/**
 * Load and validate WordPress configuration from environment variables.
 * Throws WordPressConfigError if any required variable is missing or empty.
 */
export function loadWordPressConfig(
  env: Record<string, string | undefined> = process.env,
): WordPressConfig {
  const baseUrl = env['WORDPRESS_BASE_URL'] ?? '';
  const username = env['WORDPRESS_USERNAME'] ?? '';
  const appPassword = env['WORDPRESS_APP_PASSWORD'] ?? '';

  const missing: string[] = [];
  if (!baseUrl) missing.push('WORDPRESS_BASE_URL');
  if (!username) missing.push('WORDPRESS_USERNAME');
  if (!appPassword) missing.push('WORDPRESS_APP_PASSWORD');

  if (missing.length > 0) {
    throw new WordPressConfigError(
      `Missing required WordPress configuration: ${missing.join(', ')}`,
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    username,
    appPassword,
  };
}

/** Return true when all required config fields are non-empty. */
export function isConfigComplete(config: WordPressConfig): boolean {
  return Boolean(config.baseUrl && config.username && config.appPassword);
}
