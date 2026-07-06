/**
 * Authentication middleware for Fastify — Sprint 31 + Sprint 45 RBAC.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import { compareRawApiKeys } from './api-key.js';
import type { AuthConfig } from './config.js';
import { verifyJwt } from './jwt.js';
import type { Permission } from './permissions.js';
import type { Role } from './permissions.js';
import { enrichAuthContext, hasPermission } from './rbac.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthContext = {
  role: Role;
  permissions: Permission[];
} & (
  | { type: 'jwt'; sub: string; claims: Record<string, unknown> }
  | { type: 'api-key'; keyPrefix: string }
);

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
  authenticateRequest(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  requirePermission(
    permission: Permission,
  ): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export function createAuthMiddleware(config: AuthConfig): AuthMiddleware {
  async function authenticateRequest(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!config.enabled) return;

    if (config.jwtEnabled && config.jwtSecret) {
      const token = extractBearerToken(request.headers['authorization']);
      if (token) {
        const result = verifyJwt(token, config.jwtSecret);
        if (result.valid) {
          const base = {
            type: 'jwt' as const,
            sub: String(result.claims.sub ?? ''),
            claims: result.claims as Record<string, unknown>,
            role: 'operator' as Role,
            permissions: [] as Permission[],
          };
          request.auth = enrichAuthContext(base, config);
          return;
        }
        return;
      }
    }

    if (config.apiKeyEnabled && config.apiKeys.length > 0) {
      const incoming = extractApiKey(request);
      if (incoming) {
        const match = config.apiKeys.find((k) => compareRawApiKeys(incoming, k));
        if (match) {
          const base = {
            type: 'api-key' as const,
            keyPrefix: incoming.slice(0, 8) + '…',
            role: 'admin' as Role,
            permissions: [] as Permission[],
          };
          request.auth = enrichAuthContext(base, config, match);
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

  function requirePermission(permission: Permission) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!config.enabled) return;

      await authenticateRequest(request, reply);

      if (!request.auth) {
        await reply.status(401).send({
          error: 'Unauthorized',
          message: 'A valid Bearer JWT or API key is required',
          statusCode: 401,
        });
        return;
      }

      if (!hasPermission(request.auth, permission)) {
        await reply.status(403).send({
          error: 'Forbidden',
          message: `Permission denied — requires ${permission}`,
          statusCode: 403,
          permission,
          role: request.auth.role,
        });
      }
    };
  }

  return { authenticateRequest, requireAuth, requirePermission };
}
