/**
 * Timeout abstraction for provider HTTP requests — Sprint 34.
 *
 * Centralises the `AbortSignal.timeout()` pattern so every provider
 * uses the same approach and the SDK can be swapped out later (e.g.
 * for a combined timeout+cancel signal).
 */

/** Default per-request timeout used when a provider does not override it. */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Create an `AbortSignal` that fires after `ms` milliseconds.
 *
 * Uses the native `AbortSignal.timeout()` API (Node.js 17.3+).
 * An aborted signal throws `DOMException` with name `"TimeoutError"`
 * (or `"AbortError"` in older runtimes) when passed to `fetch`.
 *
 * @param ms  Timeout in milliseconds.  Defaults to DEFAULT_PROVIDER_TIMEOUT_MS.
 */
export function createTimeoutSignal(ms: number = DEFAULT_PROVIDER_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}
