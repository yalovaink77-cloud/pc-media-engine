/**
 * Ghost Admin API JWT authentication — Sprint 35.
 *
 * Ghost Admin API keys have the format `{id}:{secret}` where `secret` is hex.
 * Requests use `Authorization: Ghost {jwt}` where the JWT is signed with HS256.
 *
 * @see https://ghost.org/docs/admin-api/#token-authentication
 */

import { createHmac } from 'node:crypto';

export type GhostApiKeyParts = {
  id: string;
  secret: Buffer;
};

/**
 * Split a Ghost Admin API key into its id and secret components.
 * Throws when the format is invalid.
 */
export function parseGhostAdminApiKey(apiKey: string): GhostApiKeyParts {
  const colonIdx = apiKey.indexOf(':');
  if (colonIdx <= 0 || colonIdx === apiKey.length - 1) {
    throw new Error('Ghost Admin API key must be in the format "{id}:{secret}"');
  }

  const id = apiKey.slice(0, colonIdx).trim();
  const secretHex = apiKey.slice(colonIdx + 1).trim();

  if (!id || !secretHex) {
    throw new Error('Ghost Admin API key must be in the format "{id}:{secret}"');
  }

  const secret = Buffer.from(secretHex, 'hex');
  if (secret.length === 0) {
    throw new Error('Ghost Admin API key secret must be valid hex');
  }

  return { id, secret };
}

/**
 * Create a short-lived Ghost Admin API JWT (5-minute expiry).
 */
export function createGhostJwt(
  apiKey: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const { id, secret } = parseGhostAdminApiKey(apiKey);

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({
      iat: nowSeconds,
      exp: nowSeconds + 300,
      aud: '/admin/',
    }),
  ).toString('base64url');

  const data = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');

  return `${data}.${signature}`;
}

/**
 * Build the `Authorization` header value for Ghost Admin API requests.
 */
export function buildGhostAuthHeader(apiKey: string): string {
  return `Ghost ${createGhostJwt(apiKey)}`;
}
