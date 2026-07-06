/**
 * Minimal JWT implementation using Node.js built-in crypto.
 *
 * Algorithm: HS256 (HMAC-SHA256).
 * No external dependencies — fully offline capable.
 *
 * Intentionally NOT compatible with RS256/ES256 (asymmetric) — that is
 * deferred to a future sprint when the auth service is extracted.
 *
 * Future: replace with jose / @fastify/jwt when asymmetric keys are needed.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JwtPayload = {
  /** Subject — typically a user ID or API client ID. */
  sub: string;
  /** Token type tag for future multi-type support. */
  type?: string;
  /** Additional custom claims. */
  [key: string]: unknown;
};

export type JwtClaims = JwtPayload & {
  /** Issued-at (Unix seconds). */
  iat: number;
  /** Expiry (Unix seconds). */
  exp: number;
};

export type JwtVerifyResult = { valid: true; claims: JwtClaims } | { valid: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecode(input: string): string {
  // Restore standard base64 padding.
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const rem = padded.length % 4;
  const padded2 = rem === 0 ? padded : padded + '='.repeat(4 - rem);
  return Buffer.from(padded2, 'base64').toString('utf8');
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const HEADER = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

/**
 * Sign a JWT with the given payload and return the compact token string.
 * The `iat` and `exp` claims are added automatically.
 */
export function signJwt(payload: JwtPayload, secret: string, expiresInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = { ...payload, iat: now, exp: now + expiresInSeconds };
  const body = base64url(JSON.stringify(claims));
  const data = `${HEADER}.${body}`;
  const sig = sign(data, secret);
  return `${data}.${sig}`;
}

/**
 * Verify a JWT string.
 * - Returns `{ valid: true, claims }` on success.
 * - Returns `{ valid: false, error }` on any failure (malformed, bad sig, expired).
 *
 * Uses timing-safe comparison to prevent signature oracle attacks.
 */
export function verifyJwt(token: string, secret: string): JwtVerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, error: 'malformed token' };

  const header = parts[0] ?? '';
  const body = parts[1] ?? '';
  const sig = parts[2] ?? '';
  const data = `${header}.${body}`;
  const expectedSig = sign(data, secret);

  // Timing-safe comparison — pad to equal length if needed.
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(sig);
  const sameSig = a.length === b.length && timingSafeEqual(a, b);

  if (!sameSig) return { valid: false, error: 'invalid signature' };

  let claims: JwtClaims;
  try {
    claims = JSON.parse(base64urlDecode(body)) as JwtClaims;
  } catch {
    return { valid: false, error: 'invalid payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && now > claims.exp) {
    return { valid: false, error: 'token expired' };
  }

  return { valid: true, claims };
}
