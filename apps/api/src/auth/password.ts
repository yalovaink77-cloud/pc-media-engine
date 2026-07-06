/**
 * Password hashing using Node.js built-in crypto.scrypt.
 *
 * Produces a self-describing hash: "<hex-salt>:<hex-key>".
 * The salt and key lengths are fixed at 32 and 64 bytes respectively.
 *
 * No external dependencies.
 * Future: swap for argon2 once native binaries are acceptable in the deploy target.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 32;
const KEY_BYTES = 64;
const SEP = ':';

// scrypt cost parameters — intentionally conservative for a beta service.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Hash a plain-text password.
 * Returns a string in the format `<hex-salt>:<hex-key>` that can be stored in the DB.
 * Uses synchronous scrypt — wrap in a worker thread if needed at high QPS.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const key = scryptSync(plain, salt, KEY_BYTES, SCRYPT_PARAMS);
  return `${salt}${SEP}${key.toString('hex')}`;
}

/**
 * Verify a plain-text password against a previously hashed value.
 * Returns true if they match, false otherwise.
 * Always uses timing-safe comparison.
 */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  const idx = storedHash.indexOf(SEP);
  if (idx === -1) return false;

  const salt = storedHash.slice(0, idx);
  const stored = storedHash.slice(idx + 1);
  if (!salt || !stored) return false;

  let key: Buffer;
  try {
    key = scryptSync(plain, salt, KEY_BYTES, SCRYPT_PARAMS);
  } catch {
    return false;
  }

  const storedBuf = Buffer.from(stored, 'hex');
  if (key.length !== storedBuf.length) return false;
  return timingSafeEqual(key, storedBuf);
}
