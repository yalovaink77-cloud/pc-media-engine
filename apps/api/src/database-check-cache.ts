/**
 * TTL cache for database health probes — Sprint 49.
 *
 * Reduces load on PostgreSQL from frequent /health and /dashboard/health
 * polling without changing response shape or semantics.
 */

import type { DatabaseStatus } from './routes/health.js';

const DEFAULT_TTL_MS = 5_000;

type CacheEntry = {
  status: DatabaseStatus;
  expiresAt: number;
};

export function createCachedDatabaseCheck(
  check: () => Promise<DatabaseStatus>,
  ttlMs = DEFAULT_TTL_MS,
): () => Promise<DatabaseStatus> {
  let cache: CacheEntry | undefined;

  return async (): Promise<DatabaseStatus> => {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      return cache.status;
    }

    const status = await check();
    cache = { status, expiresAt: now + ttlMs };
    return status;
  };
}
