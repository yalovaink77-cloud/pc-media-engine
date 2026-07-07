/**
 * Content Composer API routes — Sprint 40–41.
 *
 * Routes:
 *   GET  /composer/assets
 *   GET  /composer/assets/:id
 *   POST /composer/validate
 *   POST /composer/publish
 *   POST /composer/bulk-publish
 *   POST /composer/schedule
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

import { auditBulkPublishResult, auditPublishResult, auditRecord } from '../audit/helpers.js';
import type { AuditService } from '../audit/types.js';
import type { AuthMiddleware } from '../auth/middleware.js';
import type { ContentComposerService } from '../composer/types.js';
import { DEFAULT_COMPOSER_LIMIT, MAX_COMPOSER_LIMIT } from '../composer/types.js';
import { clampLimit, clampOffset } from '../pagination.js';
import type { PublishingQueueEnqueuer } from '../queue/publishing-enqueue.js';

export type ComposerRouteOptions = {
  composerService?: ContentComposerService;
  publishingEnqueuer?: PublishingQueueEnqueuer;
  authMiddleware?: AuthMiddleware;
  defaultProjectId: string;
  auditService?: AuditService;
};

type ComposerListQuery = {
  projectId?: string;
  limit?: string;
  offset?: string;
};

type ComposerValidateBody = {
  assetId?: string;
  publisherId?: string;
  projectId?: string;
};

type ComposerPublishBody = {
  assetId?: string;
  publisherIds?: string[] | string;
  projectId?: string;
};

type ComposerBulkPublishBody = {
  assetIds?: string[] | string;
  publisherIds?: string[] | string;
  projectId?: string;
};

type ComposerScheduleBody = {
  assetId?: string;
  publisherIds?: string[] | string;
  scheduledFor?: string;
  projectId?: string;
};

function parseIdList(raw: string[] | string | undefined): string[] {
  if (Array.isArray(raw)) return raw.map((id) => id.trim()).filter(Boolean);
  if (raw) return [raw.trim()].filter(Boolean);
  return [];
}

async function queueUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Publishing queue is not available (Redis not configured)',
    statusCode: 503,
  });
}

async function serviceUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Content composer is not available (database not configured)',
    statusCode: 503,
  });
}

async function notFound(reply: FastifyReply, message: string): Promise<void> {
  await reply.status(404).send({ error: 'Not Found', message, statusCode: 404 });
}

export async function composerRoutes(
  app: FastifyInstance,
  options: ComposerRouteOptions,
): Promise<void> {
  const { composerService, publishingEnqueuer, authMiddleware, defaultProjectId, auditService } =
    options;

  const readGuard = authMiddleware ? [authMiddleware.requirePermission('composer:read')] : [];
  const validateGuard = authMiddleware ? [authMiddleware.requirePermission('composer:write')] : [];

  app.get<{ Querystring: ComposerListQuery }>(
    '/composer/assets',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!composerService) return serviceUnavailable(reply);

      const projectId = request.query.projectId ?? defaultProjectId;
      if (!projectId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId is required (or set PCME_DEFAULT_PROJECT_ID)',
          statusCode: 400,
        });
      }

      const result = await composerService.listEligibleAssets({
        projectId,
        limit: clampLimit(request.query.limit, DEFAULT_COMPOSER_LIMIT, MAX_COMPOSER_LIMIT),
        offset: clampOffset(request.query.offset),
      });

      return reply.status(200).send(result);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { projectId?: string } }>(
    '/composer/assets/:id',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!composerService) return serviceUnavailable(reply);

      const projectId = request.query.projectId ?? defaultProjectId;
      if (!projectId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId is required',
          statusCode: 400,
        });
      }

      const asset = await composerService.getComposerAsset(projectId, request.params.id);
      if (!asset) return notFound(reply, `Asset "${request.params.id}" not found`);

      return reply.status(200).send(asset);
    },
  );

  app.post<{ Body: ComposerValidateBody }>(
    '/composer/validate',
    { preHandler: validateGuard },
    async (request, reply) => {
      if (!composerService) return serviceUnavailable(reply);

      const { assetId, publisherId } = request.body ?? {};
      const projectId = request.body?.projectId ?? defaultProjectId;

      if (!assetId?.trim()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'assetId is required',
          statusCode: 400,
        });
      }
      if (!publisherId?.trim()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'publisherId is required',
          statusCode: 400,
        });
      }
      if (!projectId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId is required',
          statusCode: 400,
        });
      }

      const result = await composerService.validate({
        projectId,
        assetId: assetId.trim(),
        publisherId: publisherId.trim(),
      });

      auditRecord(
        auditService,
        {
          type: 'composer.validation',
          severity: result.ready ? 'info' : 'warn',
          target: { type: 'asset', id: assetId.trim() },
          metadata: { publisherId: publisherId.trim(), ready: result.ready },
        },
        request,
      );

      return reply.status(200).send(result);
    },
  );

  app.post<{ Body: ComposerPublishBody }>(
    '/composer/publish',
    { preHandler: authMiddleware ? [authMiddleware.requirePermission('publishing:write')] : [] },
    async (request, reply) => {
      if (!composerService) return serviceUnavailable(reply);
      if (!publishingEnqueuer) return queueUnavailable(reply);

      const projectId = request.body?.projectId ?? defaultProjectId;
      const assetId = request.body?.assetId?.trim();
      const rawIds = request.body?.publisherIds;
      const publisherIds = Array.isArray(rawIds)
        ? rawIds.map((id) => id.trim()).filter(Boolean)
        : rawIds
          ? [rawIds.trim()]
          : [];

      if (!assetId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'assetId is required',
          statusCode: 400,
        });
      }
      if (!publisherIds.length) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'publisherIds must contain at least one publisher',
          statusCode: 400,
        });
      }
      if (!projectId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId is required',
          statusCode: 400,
        });
      }

      const result = await composerService.publish({ projectId, assetId, publisherIds });
      auditPublishResult(auditService, request, assetId, result);
      return reply.status(202).send(result);
    },
  );

  app.post<{ Body: ComposerBulkPublishBody }>(
    '/composer/bulk-publish',
    { preHandler: authMiddleware ? [authMiddleware.requirePermission('publishing:write')] : [] },
    async (request, reply) => {
      if (!composerService) return serviceUnavailable(reply);
      if (!publishingEnqueuer) return queueUnavailable(reply);

      const projectId = request.body?.projectId ?? defaultProjectId;
      const assetIds = parseIdList(request.body?.assetIds);
      const publisherIds = parseIdList(request.body?.publisherIds);

      if (!assetIds.length) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'assetIds must contain at least one asset',
          statusCode: 400,
        });
      }
      if (!publisherIds.length) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'publisherIds must contain at least one publisher',
          statusCode: 400,
        });
      }
      if (!projectId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId is required',
          statusCode: 400,
        });
      }

      const result = await composerService.bulkPublish({ projectId, assetIds, publisherIds });
      auditBulkPublishResult(auditService, request, result);
      return reply.status(202).send(result);
    },
  );

  app.post<{ Body: ComposerScheduleBody }>(
    '/composer/schedule',
    { preHandler: authMiddleware ? [authMiddleware.requirePermission('scheduling:write')] : [] },
    async (request, reply) => {
      if (!composerService) return serviceUnavailable(reply);
      if (!publishingEnqueuer) return queueUnavailable(reply);

      const projectId = request.body?.projectId ?? defaultProjectId;
      const assetId = request.body?.assetId?.trim();
      const scheduledFor = request.body?.scheduledFor?.trim();
      const publisherIds = parseIdList(request.body?.publisherIds);

      if (!assetId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'assetId is required',
          statusCode: 400,
        });
      }
      if (!publisherIds.length) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'publisherIds must contain at least one publisher',
          statusCode: 400,
        });
      }
      if (!scheduledFor) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'scheduledFor is required (ISO 8601)',
          statusCode: 400,
        });
      }
      if (!projectId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId is required',
          statusCode: 400,
        });
      }

      const result = await composerService.schedule({
        projectId,
        assetId,
        publisherIds,
        scheduledFor,
      });
      auditRecord(
        auditService,
        {
          type: 'composer.schedule',
          severity: 'info',
          target: { type: 'asset', id: assetId },
          metadata: { publisherIds, scheduledFor },
        },
        request,
      );
      return reply.status(202).send(result);
    },
  );
}

export type {
  ComposerAssetDetail,
  ComposerAssetListResult,
  ComposerBulkPublishResult,
  ComposerPublishResult,
  ComposerScheduleResult,
  ComposerValidateResult,
} from '../composer/types.js';
