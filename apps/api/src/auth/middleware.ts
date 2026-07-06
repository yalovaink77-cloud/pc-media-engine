/**
 * Authentication middleware for Fastify — Sprint 31.
 *
 * Supports two credential schemes:
 *   1. Bearer JWT   — `Authorization: Bearer <token>`
 *   2. API Key      — `Authorization: ApiKey <key>`  OR  `X-API-Key: <key>`
 *
 * Usage:
 *   const { authenticateRequest, requireAuth } = createAuthMiddleware(authConfig);
 *
 *   // Optional auth — attaches context if credentials are present.
 *   app.addHook('onRequest', authenticateRequest);
 *
 *   // Required auth — returns 401 if no valid credential found.
 *   app.get('/protected', { preHandler: [requireAuth] }, handler);
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import { compareRawApiKeys } from './api-key.js';
import type { AuthConfig } from './config.js';
import { verifyJwt } from './jwt.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthContext =
  | { type: 'jwt'; sub: string; claims: Record<string, unknown> }
  | { type: 'api-key'; keyPrefix: string };

// Augment FastifyRequest so route handlers can access request.auth.
declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  return match?.[1] ?? null;
}

function extractApiKey(request: FastifyRequest): string | null {
  const authHeader = request.headers['authorization'];
  if (authHeader) {
    const match = /^ApiKey\s+(.+)$/i.exec(authHeader);
    if (match?.[1]) return match[1];
  }
  const xApiKey = request.headers['x-api-key'];
  return typeof xApiKey === 'string' ? xApiKey : null;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

export type AuthMiddleware = {
  /**
   * Optional-auth hook — populates `request.auth` when valid credentials
   * are present, but does NOT reject requests without credentials.
   * Add as `app.addHook('onRequest', authenticateRequest)`.
   */
  authenticateRequest(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  /**
   * Required-auth preHandler — calls `authenticateRequest` then rejects
   * with 401 if `request.auth` is not set.
   * Add as `{ preHandler: [requireAuth] }` on individual routes.
   */
  requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
};

export function createAuthMiddleware(config: AuthConfig): AuthMiddleware {
  async function authenticateRequest(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!config.enabled) return;

    // --- Try JWT bearer ---
    if (config.jwtEnabled && config.jwtSecret) {
      const token = extractBearerToken(request.headers['authorization']);
      if (token) {
        const result = verifyJwt(token, config.jwtSecret);
        if (result.valid) {
          request.auth = {
            type: 'jwt',
            sub: String(result.claims.sub ?? ''),
            claims: result.claims as Record<string, unknown>,
          };
          return;
        }
        // Invalid JWT — do not fall through to API key check.
        return;
      }
    }

    // --- Try API key ---
    if (config.apiKeyEnabled && config.apiKeys.length > 0) {
      const incoming = extractApiKey(request);
      if (incoming) {
        const match = config.apiKeys.find((k) => compareRawApiKeys(incoming, k));
        if (match) {
          request.auth = {
            type: 'api-key',
            keyPrefix: incoming.slice(0, 8) + '…',
          };
        }
      }
    }
  }

  async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await authenticateRequest(request, reply);

    if (config.enabled && !request.auth) {
      await reply.status(401).send({
        error: 'Unauthorized',
        message: 'A valid Bearer JWT or API key is required',
        statusCode: 401,
      });
    }
  }

  return { authenticateRequest, requireAuth };
}
