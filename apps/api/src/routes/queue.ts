/**
 * Queue operations API routes — Sprint 32.
 *
 * All routes require authentication (requireAuth preHandler from Sprint 31).
 * When no QueueService is injected, routes return 503 Service Unavailable.
 *
 * Routes:
 *   GET    /queue/status
 *   POST   /queue/pause
 *   POST   /queue/resume
 *   POST   /queue/drain
 *   POST   /queue/jobs/:id/retry
 *   DELETE /queue/jobs/:id
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

import type { AuthMiddleware } from '../auth/middleware.js';
import type { QueueService, QueueStatus } from '../queue/queue-service.js';
import { QueueJobNotFoundError, QueueJobStateError } from '../queue/queue-service.js';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export type QueueStatusResponse = QueueStatus;

export type QueueCommandResponse = {
  success: boolean;
  message: string;
};

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export type QueueRouteOptions = {
  /**
   * Operational queue service.
   * When absent all routes return 503 — queue management not available.
   */
  queueService?: QueueService;
  /** Auth middleware from Sprint 31 — requireAuth is used on every route. */
  authMiddleware: AuthMiddleware;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function serviceUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Queue management is not available (no Redis connection configured)',
    statusCode: 503,
  });
}

async function notFound(reply: FastifyReply, message: string): Promise<void> {
  await reply.status(404).send({ error: 'Not Found', message, statusCode: 404 });
}

async function conflict(reply: FastifyReply, message: string): Promise<void> {
  await reply.status(409).send({ error: 'Conflict', message, statusCode: 409 });
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function queueRoutes(app: FastifyInstance, options: QueueRouteOptions): Promise<void> {
  const { queueService, authMiddleware } = options;
  const { requirePermission } = authMiddleware;

  app.get(
    '/queue/status',
    { preHandler: [requirePermission('queue:read')] },
    async (_request, reply: FastifyReply) => {
      if (!queueService) return serviceUnavailable(reply);
      const status = await queueService.getStatus();
      return reply.status(200).send(status);
    },
  );

  // ------------------------------------------------------------------
  // POST /queue/pause
  // ------------------------------------------------------------------
  app.post(
    '/queue/pause',
    { preHandler: [requirePermission('queue:write')] },
    async (_request, reply: FastifyReply) => {
      if (!queueService) return serviceUnavailable(reply);
      await queueService.pause();
      return reply.status(200).send({ success: true, message: 'Queue paused' });
    },
  );

  // ------------------------------------------------------------------
  // POST /queue/resume
  // ------------------------------------------------------------------
  app.post(
    '/queue/resume',
    { preHandler: [requirePermission('queue:write')] },
    async (_request, reply: FastifyReply) => {
      if (!queueService) return serviceUnavailable(reply);
      await queueService.resume();
      return reply.status(200).send({ success: true, message: 'Queue resumed' });
    },
  );

  // ------------------------------------------------------------------
  // POST /queue/drain
  // ------------------------------------------------------------------
  app.post(
    '/queue/drain',
    { preHandler: [requirePermission('queue:write')] },
    async (_request, reply: FastifyReply) => {
      if (!queueService) return serviceUnavailable(reply);
      await queueService.drain();
      return reply.status(200).send({ success: true, message: 'Queue drained' });
    },
  );

  // ------------------------------------------------------------------
  // POST /queue/jobs/:id/retry
  // ------------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/queue/jobs/:id/retry',
    { preHandler: [requirePermission('queue:write')] },
    async (request, reply) => {
      if (!queueService) return serviceUnavailable(reply);
      const { id } = request.params;
      try {
        await queueService.retryJob(id);
        return reply.status(200).send({ success: true, message: `Job ${id} queued for retry` });
      } catch (err) {
        if (err instanceof QueueJobNotFoundError) return notFound(reply, err.message);
        if (err instanceof QueueJobStateError) return conflict(reply, err.message);
        throw err;
      }
    },
  );

  // ------------------------------------------------------------------
  // DELETE /queue/jobs/:id
  // ------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    '/queue/jobs/:id',
    { preHandler: [requirePermission('queue:write')] },
    async (request, reply) => {
      if (!queueService) return serviceUnavailable(reply);
      const { id } = request.params;
      try {
        await queueService.removeJob(id);
        return reply.status(200).send({ success: true, message: `Job ${id} removed` });
      } catch (err) {
        if (err instanceof QueueJobNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );
}
