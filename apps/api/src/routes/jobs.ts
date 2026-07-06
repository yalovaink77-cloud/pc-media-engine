/**
 * Publishing jobs API routes — Sprint 38.
 *
 * Read-only job introspection backed by the BullMQ publishing queue.
 * Requires authentication (same as /queue/* routes).
 *
 * Routes:
 *   GET /jobs
 *   GET /jobs/:id
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

import type { AuthMiddleware } from '../auth/middleware.js';
import type { Config } from '../config.js';
import { DEFAULT_JOB_LIMIT, isJobStatus, MAX_JOB_LIMIT } from '../queue/job-types.js';
import type { JobDetail, JobListResult } from '../queue/queue-service.js';
import type { QueueService } from '../queue/queue-service.js';
import { QueueJobNotFoundError } from '../queue/queue-service.js';

export type JobsRouteOptions = {
  queueService?: QueueService;
  authMiddleware: AuthMiddleware;
  publishingConfig: Pick<Config, 'publisherDriver'>;
};

type JobsListQuery = {
  status?: string;
  publisher?: string;
  projectId?: string;
  assetId?: string;
  limit?: string;
  offset?: string;
};

async function serviceUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Job management is not available (no Redis connection configured)',
    statusCode: 503,
  });
}

async function notFound(reply: FastifyReply, message: string): Promise<void> {
  await reply.status(404).send({ error: 'Not Found', message, statusCode: 404 });
}

function parseLimit(raw?: string): number {
  const n = raw ? parseInt(raw, 10) : DEFAULT_JOB_LIMIT;
  if (Number.isNaN(n) || n < 1) return DEFAULT_JOB_LIMIT;
  return Math.min(n, MAX_JOB_LIMIT);
}

function parseOffset(raw?: string): number {
  const n = raw ? parseInt(raw, 10) : 0;
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

export async function jobsRoutes(app: FastifyInstance, options: JobsRouteOptions): Promise<void> {
  const { queueService, authMiddleware, publishingConfig } = options;
  const { requirePermission } = authMiddleware;
  const publisherDriver = publishingConfig.publisherDriver ?? 'mock';

  app.get<{ Querystring: JobsListQuery }>(
    '/jobs',
    { preHandler: [requirePermission('jobs:read')] },
    async (request, reply) => {
      if (!queueService) return serviceUnavailable(reply);

      const { status, publisher, projectId, assetId, limit, offset } = request.query;
      if (status && !isJobStatus(status)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid status "${status}". Allowed: waiting, active, delayed, failed, completed`,
          statusCode: 400,
        });
      }

      const result: JobListResult = await queueService.listJobs(
        {
          status,
          publisher,
          projectId,
          assetId,
          limit: parseLimit(limit),
          offset: parseOffset(offset),
        },
        publisherDriver,
      );

      return reply.status(200).send(result);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/jobs/:id',
    { preHandler: [requirePermission('jobs:read')] },
    async (request, reply) => {
      if (!queueService) return serviceUnavailable(reply);

      try {
        const job: JobDetail = await queueService.getJob(request.params.id, publisherDriver);
        return reply.status(200).send(job);
      } catch (err) {
        if (err instanceof QueueJobNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );
}

export type { JobDetail, JobListResult };
