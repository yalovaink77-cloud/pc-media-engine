/**
 * Activity / audit log API routes — Sprint 46.
 *
 * Routes:
 *   GET /activity
 *   GET /activity/:id
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

import type { AuditService } from '../audit/types.js';
import { DEFAULT_AUDIT_LIMIT, MAX_AUDIT_LIMIT } from '../audit/types.js';
import type { AuthMiddleware } from '../auth/middleware.js';

export type ActivityRouteOptions = {
  auditService?: AuditService;
  authMiddleware?: AuthMiddleware;
};

type ActivityListQuery = {
  type?: string;
  actor?: string;
  target?: string;
  start?: string;
  end?: string;
  limit?: string;
};

async function serviceUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Activity log is not available',
    statusCode: 503,
  });
}

function parseLimit(raw?: string): number {
  const n = raw ? parseInt(raw, 10) : DEFAULT_AUDIT_LIMIT;
  if (Number.isNaN(n) || n < 1) return DEFAULT_AUDIT_LIMIT;
  return Math.min(n, MAX_AUDIT_LIMIT);
}

export async function activityRoutes(
  app: FastifyInstance,
  options: ActivityRouteOptions,
): Promise<void> {
  const { auditService, authMiddleware } = options;
  const readGuard = authMiddleware ? [authMiddleware.requirePermission('activity:read')] : [];

  app.get<{ Querystring: ActivityListQuery }>(
    '/activity',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!auditService) return serviceUnavailable(reply);
      const { type, actor, target, start, end, limit: limitRaw } = request.query;
      const result = await auditService.list({
        type,
        actor,
        target,
        start,
        end,
        limit: parseLimit(limitRaw),
      });
      return reply.status(200).send(result);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/activity/:id',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!auditService) return serviceUnavailable(reply);
      const event = await auditService.getById(request.params.id);
      if (!event) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Activity event "${request.params.id}" not found`,
          statusCode: 404,
        });
      }
      return reply.status(200).send(event);
    },
  );
}
