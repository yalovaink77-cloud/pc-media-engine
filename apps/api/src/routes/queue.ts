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

import { auditRecord } from '../audit/helpers.js';
import type { AuditService } from '../audit/types.js';
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
  /** Optional audit service — Sprint 46. */
  auditService?: AuditService;
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
  const { queueService, authMiddleware, auditService } = options;
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
    async (request, reply: FastifyReply) => {
      if (!queueService) return serviceUnavailable(reply);
      await queueService.pause();
      auditRecord(
        auditService,
        {
          type: 'queue.pause',
          severity: 'info',
          target: { type: 'queue', id: 'publishing' },
        },
        request,
      );
      return reply.status(200).send({ success: true, message: 'Queue paused' });
    },
  );

  // ------------------------------------------------------------------
  // POST /queue/resume
  // ------------------------------------------------------------------
  app.post(
    '/queue/resume',
    { preHandler: [requirePermission('queue:write')] },
    async (request, reply: FastifyReply) => {
      if (!queueService) return serviceUnavailable(reply);
      await queueService.resume();
      auditRecord(
        auditService,
        {
          type: 'queue.resume',
          severity: 'info',
          target: { type: 'queue', id: 'publishing' },
        },
        request,
      );
      return reply.status(200).send({ success: true, message: 'Queue resumed' });
    },
  );

  // ------------------------------------------------------------------
  // POST /queue/drain
  // ------------------------------------------------------------------
  app.post(
    '/queue/drain',
    { preHandler: [requirePermission('queue:write')] },
    async (request, reply: FastifyReply) => {
      if (!queueService) return serviceUnavailable(reply);
      await queueService.drain();
      auditRecord(
        auditService,
        {
          type: 'queue.drain',
          severity: 'info',
          target: { type: 'queue', id: 'publishing' },
        },
        request,
      );
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
        auditRecord(
          auditService,
          {
            type: 'queue.retry',
            severity: 'info',
            target: { type: 'job', id },
          },
          request,
        );
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
        auditRecord(
          auditService,
          {
            type: 'queue.remove',
            severity: 'info',
            target: { type: 'job', id },
          },
          request,
        );
        return reply.status(200).send({ success: true, message: `Job ${id} removed` });
      } catch (err) {
        if (err instanceof QueueJobNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );
}
