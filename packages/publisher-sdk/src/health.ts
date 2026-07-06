/**
 * Provider health types — Sprint 34.
 *
 * Extends the basic HealthResult from @pcme/publishing with structured
 * metadata: when the check ran, how long it took, and any detail object.
 */

export type ProviderHealthStatus = 'ok' | 'degraded' | 'down';

/**
 * Health snapshot returned by `PublisherProvider.health()`.
 * Superset of `@pcme/publishing` HealthResult — compatible with existing
 * `Publisher.health()` callers.
 */
export type ProviderHealth = {
  status: ProviderHealthStatus;
  /** Human-readable detail, e.g. "Authenticated as admin". */
  message?: string;
  /** When this health check was performed. */
  checkedAt: Date;
  /** Round-trip time of the health probe, when available. */
  responseTimeMs?: number;
};
