/**
 * Notification API routes — Sprint 47.
 *
 * Routes:
 *   GET  /notifications
 *   POST /notifications/:id/read
 *   POST /notifications/read-all
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

import type { AuthMiddleware } from '../auth/middleware.js';
import type { NotificationSeverity } from '../notifications/types.js';
import type { NotificationService } from '../notifications/types.js';
import { DEFAULT_NOTIFICATION_LIMIT, MAX_NOTIFICATION_LIMIT } from '../notifications/types.js';
import { clampLimit } from '../pagination.js';

export type NotificationsRouteOptions = {
  notificationService?: NotificationService;
  authMiddleware?: AuthMiddleware;
};

type NotificationListQuery = {
  unread?: string;
  severity?: string;
  limit?: string;
};

async function serviceUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Notification center is not available',
    statusCode: 503,
  });
}

function parseUnread(raw?: string): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

function isSeverity(value: string | undefined): value is NotificationSeverity {
  return value === 'info' || value === 'warn' || value === 'error' || value === 'critical';
}

export async function notificationsRoutes(
  app: FastifyInstance,
  options: NotificationsRouteOptions,
): Promise<void> {
  const { notificationService, authMiddleware } = options;
  const readGuard = authMiddleware ? [authMiddleware.requirePermission('notifications:read')] : [];

  app.get<{ Querystring: NotificationListQuery }>(
    '/notifications',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!notificationService) return serviceUnavailable(reply);
      const { unread: unreadRaw, severity, limit: limitRaw } = request.query;
      const result = await notificationService.list({
        unread: parseUnread(unreadRaw),
        severity: isSeverity(severity) ? severity : undefined,
        limit: clampLimit(limitRaw, DEFAULT_NOTIFICATION_LIMIT, MAX_NOTIFICATION_LIMIT),
      });
      return reply.status(200).send(result);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!notificationService) return serviceUnavailable(reply);
      const updated = await notificationService.markRead(request.params.id);
      if (!updated) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Notification "${request.params.id}" not found`,
          statusCode: 404,
        });
      }
      return reply.status(200).send({ success: true, notification: updated });
    },
  );

  app.post('/notifications/read-all', { preHandler: readGuard }, async (_request, reply) => {
    if (!notificationService) return serviceUnavailable(reply);
    const marked = await notificationService.markAllRead();
    return reply.status(200).send({ success: true, marked });
  });
}
