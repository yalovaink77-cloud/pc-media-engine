/**
 * API key generation, hashing, and comparison.
 *
 * Generated keys are prefixed with `pcme_` for easy identification.
 * Keys are stored as SHA-256 hashes to prevent exposure if the store is compromised.
 *
 * In Sprint 31, raw keys can also be compared directly (env-var workflow).
 * Sprint 32+ will migrate to DB-backed hashed keys.
 *
 * No external dependencies.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'pcme_';

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random API key.
 * Format: `pcme_<43-char base64url>` (~258 bits of entropy).
 */
export function generateApiKey(): string {
  return `${PREFIX}${randomBytes(32).toString('base64url')}`;
}

// ---------------------------------------------------------------------------
// Hashing (for DB storage)
// ---------------------------------------------------------------------------

/**
 * Produce a SHA-256 hex digest of a raw API key.
 * Store this digest in the database — never the raw key.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Compare a raw API key against a stored SHA-256 hash.
 * Timing-safe; returns false immediately on length mismatch.
 */
export function compareApiKeyToHash(rawKey: string, storedHash: string): boolean {
  const incoming = Buffer.from(hashApiKey(rawKey), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (incoming.length !== stored.length) return false;
  return timingSafeEqual(incoming, stored);
}

/**
 * Compare a raw incoming key against a raw expected key.
 * Used for env-var based key lookup (Sprint 31 simplification).
 * Timing-safe.
 */
export function compareRawApiKeys(incoming: string, expected: string): boolean {
  const a = Buffer.from(incoming);
  const b = Buffer.from(expected);
  // Constant-time comparison — pad shorter to prevent length leakage.
  if (a.length !== b.length) {
    // Still run timingSafeEqual on equal-length subsets to avoid short-circuit.
    const min = Math.min(a.length, b.length);
    timingSafeEqual(a.slice(0, min), b.slice(0, min));
    return false;
  }
  return timingSafeEqual(a, b);
}
