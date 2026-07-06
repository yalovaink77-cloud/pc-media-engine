import type { FastifyInstance } from 'fastify';

import type { AuthConfig } from '../auth/index.js';
import type { AuthMiddleware } from '../auth/middleware.js';
import { getRbacMetadata } from '../auth/rbac.js';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type AuthHealthResponse = {
  status: 'ok';
  authEnabled: boolean;
  jwtEnabled: boolean;
  apiKeyEnabled: boolean;
  version: string;
};

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export type AuthRouteOptions = {
  authConfig: AuthConfig;
  version: string;
  /** Optional middleware — used to add requireAuth to future protected routes. */
  middleware?: AuthMiddleware;
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function authRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  const { authConfig, version } = options;

  /**
   * GET /auth/health
   * Returns the current authentication configuration status.
   * Always public — allows monitoring tools to check auth availability.
   */
  app.get<{ Reply: AuthHealthResponse }>(
    '/auth/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              authEnabled: { type: 'boolean' },
              jwtEnabled: { type: 'boolean' },
              apiKeyEnabled: { type: 'boolean' },
              version: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const body: AuthHealthResponse = {
        status: 'ok',
        authEnabled: authConfig.enabled,
        jwtEnabled: authConfig.jwtEnabled,
        apiKeyEnabled: authConfig.apiKeyEnabled,
        version,
      };
      return reply.status(200).send(body);
    },
  );

  app.get('/auth/rbac', async (_request, reply) => {
    const metadata = getRbacMetadata();
    return reply.status(200).send({
      status: 'ok',
      authEnabled: authConfig.enabled,
      ...metadata,
    });
  });
}
