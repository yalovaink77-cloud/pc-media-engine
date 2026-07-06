/**
 * PublisherError and retry classification — Sprint 34.
 *
 * Provides a common error hierarchy and retry decision helper so all
 * providers use consistent semantics.  Provider-specific error classes
 * (e.g. WordPressApiError) should extend PublisherError or at minimum
 * carry a compatible `category` field.
 */

// ---------------------------------------------------------------------------
// Error category
// ---------------------------------------------------------------------------

/**
 * Semantic classification of a publish failure.
 *
 * Used by the retry engine to decide whether to schedule another attempt:
 *
 *   auth         → do NOT retry (fix credentials first)
 *   rate_limit   → retry with backoff (respect Retry-After)
 *   not_found    → do NOT retry (resource gone)
 *   server_error → retry (transient 5xx)
 *   network      → retry (connectivity issue)
 *   validation   → do NOT retry (payload is wrong)
 *   unknown      → do NOT retry (conservative default)
 */
export type ErrorCategory =
  'auth' | 'rate_limit' | 'not_found' | 'server_error' | 'network' | 'validation' | 'unknown';

// ---------------------------------------------------------------------------
// Base error class
// ---------------------------------------------------------------------------

/**
 * Base class for all publisher provider errors.
 *
 * Concrete providers may extend this (e.g. `WordPressApiError extends PublisherError`)
 * or create their own error classes that carry a compatible `category` field.
 */
export class PublisherError extends Error {
  public readonly category: ErrorCategory;
  public readonly retryable: boolean;

  constructor(message: string, category: ErrorCategory = 'unknown') {
    super(message);
    this.name = 'PublisherError';
    this.category = category;
    this.retryable = isRetryableCategory(category);
  }
}

// ---------------------------------------------------------------------------
// Retry classification
// ---------------------------------------------------------------------------

/**
 * Return true when errors of the given `category` are safe to retry.
 *
 * Retryable categories: rate_limit, server_error, network.
 * Non-retryable: auth, not_found, validation, unknown.
 */
export function isRetryableCategory(category: ErrorCategory): boolean {
  return category === 'rate_limit' || category === 'server_error' || category === 'network';
}

/**
 * Return true when the given error instance is retryable.
 *
 * Handles:
 *  - `PublisherError` instances (uses `category`)
 *  - `TypeError` (network fetch failure)
 *  - `AbortError` / `TimeoutError` (request timeout)
 *  - Any object with a compatible `category` string field
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof PublisherError) return err.retryable;

  if (err instanceof TypeError) return true;

  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  }

  // Duck-typing for provider errors that carry `category` but don't extend
  // PublisherError (e.g. legacy WordPressApiError).
  if (
    err !== null &&
    typeof err === 'object' &&
    'category' in err &&
    typeof (err as { category: unknown }).category === 'string'
  ) {
    return isRetryableCategory((err as { category: string }).category as ErrorCategory);
  }

  return false;
}
