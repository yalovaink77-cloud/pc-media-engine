/**
 * WordPress plugin configuration — Sprint 33 production hardening.
 *
 * Supported environment variables:
 *   WORDPRESS_URL           — site URL (preferred, Sprint 33)
 *   WORDPRESS_BASE_URL      — legacy alias (still accepted)
 *   WORDPRESS_USERNAME      — WordPress username
 *   WORDPRESS_APP_PASSWORD  — WordPress Application Password
 *   WORDPRESS_REQUEST_TIMEOUT_MS — request timeout in ms (default: 30000)
 *
 * WORDPRESS_URL takes precedence over WORDPRESS_BASE_URL when both are set.
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
  /**
   * Maximum time (ms) to wait for any single WordPress API request.
   * Default: 30 000 ms.  Sprint 33+.
   * Optional so existing code that constructs WordPressConfig directly
   * (e.g. tests, legacy call sites) is not broken.
   */
  requestTimeoutMs?: number;
};

export class WordPressConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordPressConfigError';
  }
}

// ---------------------------------------------------------------------------
// URL validation helpers
// ---------------------------------------------------------------------------

/**
 * Return true when the URL string has a valid http/https scheme and a host.
 * Does NOT require HTTPS so that local dev environments work out of the box.
 */
export function isValidWordPressUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Return true when the URL uses HTTPS.
 * Use for production validation warnings.
 */
export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

/**
 * Load and validate WordPress configuration from environment variables.
 *
 * WORDPRESS_URL takes precedence over WORDPRESS_BASE_URL.
 * Throws WordPressConfigError if any required variable is missing or the URL
 * format is invalid.
 */
export function loadWordPressConfig(
  env: Record<string, string | undefined> = process.env,
): WordPressConfig {
  // Accept WORDPRESS_URL (preferred) or WORDPRESS_BASE_URL (legacy).
  const rawUrl = (env['WORDPRESS_URL'] ?? '').trim() || (env['WORDPRESS_BASE_URL'] ?? '').trim();
  const username = (env['WORDPRESS_USERNAME'] ?? '').trim();
  const appPassword = (env['WORDPRESS_APP_PASSWORD'] ?? '').trim();
  const timeoutRaw = env['WORDPRESS_REQUEST_TIMEOUT_MS'];

  const missing: string[] = [];
  if (!rawUrl) missing.push('WORDPRESS_URL (or WORDPRESS_BASE_URL)');
  if (!username) missing.push('WORDPRESS_USERNAME');
  if (!appPassword) missing.push('WORDPRESS_APP_PASSWORD');

  if (missing.length > 0) {
    throw new WordPressConfigError(
      `Missing required WordPress configuration: ${missing.join(', ')}`,
    );
  }

  if (!isValidWordPressUrl(rawUrl)) {
    throw new WordPressConfigError(
      `WORDPRESS_URL "${rawUrl}" is not a valid URL — must start with http:// or https://`,
    );
  }

  const requestTimeoutMs = timeoutRaw ? parseInt(timeoutRaw, 10) : 30_000;

  if (Number.isNaN(requestTimeoutMs) || requestTimeoutMs < 1) {
    throw new WordPressConfigError(
      `WORDPRESS_REQUEST_TIMEOUT_MS must be a positive integer (got: ${timeoutRaw})`,
    );
  }

  return {
    baseUrl: rawUrl.replace(/\/+$/, ''),
    username,
    appPassword,
    requestTimeoutMs,
  };
}

/** Return true when all required config fields are non-empty. */
export function isConfigComplete(config: WordPressConfig): boolean {
  return Boolean(config.baseUrl && config.username && config.appPassword);
}

// ---------------------------------------------------------------------------
// Strict (production) validation
// ---------------------------------------------------------------------------

export type WordPressConfigValidation = {
  errors: string[];
  warnings: string[];
};

/**
 * Validate a `WordPressConfig` for production readiness.
 * Returns errors and warnings without throwing.
 *
 * Errors: conditions that will definitely break publishing.
 * Warnings: conditions that may cause issues in production.
 */
export function validateWordPressConfigStrict(config: WordPressConfig): WordPressConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.baseUrl) {
    errors.push('baseUrl is required');
  } else {
    if (!isValidWordPressUrl(config.baseUrl)) {
      errors.push(`baseUrl "${config.baseUrl}" is not a valid URL`);
    } else if (!isHttpsUrl(config.baseUrl)) {
      warnings.push(
        `baseUrl uses HTTP instead of HTTPS — credentials will be sent in plaintext. Use HTTPS in production.`,
      );
    }
  }

  if (!config.username) errors.push('username is required');

  if (!config.appPassword) {
    errors.push('appPassword is required');
  } else if (config.appPassword.length < 8) {
    warnings.push('appPassword appears very short — ensure it is a WordPress Application Password');
  }

  const timeout = config.requestTimeoutMs ?? 30_000;
  if (timeout < 5_000) {
    warnings.push(
      `requestTimeoutMs (${timeout}ms) is very low — WordPress media uploads may exceed this`,
    );
  }

  return { errors, warnings };
}
