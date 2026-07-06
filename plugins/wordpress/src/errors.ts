/**
 * WordPress API error types and helpers — Sprint 33.
 *
 * Provides:
 *  - WordPressErrorCategory — semantic classification of HTTP errors
 *  - WordPressApiError — enriched error class with category
 *  - categorizeHttpStatus() — map HTTP status to category
 *  - isRetryableError() — true for transient errors safe to retry
 */

// ---------------------------------------------------------------------------
// Error category
// ---------------------------------------------------------------------------

/**
 * Semantic category for a WordPress API failure.
 *
 * Used by the retry engine to decide whether to retry:
 *   - auth        → do NOT retry (fix credentials first)
 *   - rate_limit  → retry with backoff (respect Retry-After)
 *   - not_found   → do NOT retry (resource gone)
 *   - server_error → retry (transient 5xx)
 *   - network     → retry (connectivity issue)
 *   - validation  → do NOT retry (our payload is wrong)
 *   - unknown     → do NOT retry (conservative default)
 */
export type WordPressErrorCategory =
  'auth' | 'rate_limit' | 'not_found' | 'server_error' | 'network' | 'validation' | 'unknown';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Thrown when the WordPress REST API returns a non-2xx status.
 * Contains the HTTP status, the WP error code, and a semantic category.
 */
export class WordPressApiError extends Error {
  public readonly category: WordPressErrorCategory;

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    category?: WordPressErrorCategory,
  ) {
    super(message);
    this.name = 'WordPressApiError';
    this.category = category ?? categorizeHttpStatus(status);
  }
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

/**
 * Map an HTTP status code to a `WordPressErrorCategory`.
 */
export function categorizeHttpStatus(status: number): WordPressErrorCategory {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status === 400 || status === 422) return 'validation';
  if (status >= 500 && status < 600) return 'server_error';
  return 'unknown';
}

/**
 * Map a WP REST API error code string to a category.
 * Takes precedence over HTTP-status categorization when recognised.
 */
export function categorizeWpErrorCode(code: string): WordPressErrorCategory | null {
  const c = code.toLowerCase();
  if (
    c === 'rest_not_logged_in' ||
    c === 'rest_forbidden' ||
    c === 'rest_cannot_read' ||
    c === 'rest_cannot_edit' ||
    c === 'rest_cannot_create'
  )
    return 'auth';
  if (c === 'rest_post_invalid_id' || c === 'rest_no_route') return 'not_found';
  if (c.startsWith('rest_invalid_param')) return 'validation';
  return null;
}

/**
 * Build a `WordPressApiError` from an HTTP response, using both the status
 * code and the WP error body for best categorization.
 */
export async function parseWordPressErrorResponse(response: Response): Promise<WordPressApiError> {
  let code = 'unknown';
  let message = `WordPress returned HTTP ${response.status}`;
  let category: WordPressErrorCategory = categorizeHttpStatus(response.status);

  try {
    const body = (await response.json()) as {
      code?: string;
      message?: string;
      data?: { status?: number };
    };
    if (body.code) {
      code = body.code;
      const codeCat = categorizeWpErrorCode(body.code);
      if (codeCat) category = codeCat;
    }
    if (body.message) message = body.message;
  } catch {
    // unparseable body — keep defaults
  }

  return new WordPressApiError(response.status, code, message, category);
}

// ---------------------------------------------------------------------------
// Retryability
// ---------------------------------------------------------------------------

/**
 * Return true when the error is considered transient and safe to retry.
 *
 * - Rate limit (429) → retry
 * - Server errors (5xx) → retry
 * - Network errors → retry
 * - Auth, validation, not_found → do NOT retry
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof WordPressApiError) {
    return (
      err.category === 'rate_limit' || err.category === 'server_error' || err.category === 'network'
    );
  }
  // Plain network errors (fetch failure, abort, DNS) are retryable.
  if (err instanceof TypeError) return true;
  // AbortError from timeout signal → retryable (transient timeout).
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}
