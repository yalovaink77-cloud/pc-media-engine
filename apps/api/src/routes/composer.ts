/**
 * Content Composer API routes — Sprint 40.
 *
 * Read-only inspection + validation. No publishing or DB mutations.
 *
 * Routes:
 *   GET  /composer/assets
 *   GET  /composer/assets/:id
 *   POST /composer/validate
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

import type { ContentComposerService } from '../composer/types.js';
import { DEFAULT_COMPOSER_LIMIT, MAX_COMPOSER_LIMIT } from '../composer/types.js';

export type ComposerRouteOptions = {
  composerService?: ContentComposerService;
  defaultProjectId: string;
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

function parseLimit(raw?: string): number {
  const n = raw ? parseInt(raw, 10) : DEFAULT_COMPOSER_LIMIT;
  if (Number.isNaN(n) || n < 1) return DEFAULT_COMPOSER_LIMIT;
  return Math.min(n, MAX_COMPOSER_LIMIT);
}

function parseOffset(raw?: string): number {
  const n = raw ? parseInt(raw, 10) : 0;
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

export async function composerRoutes(
  app: FastifyInstance,
  options: ComposerRouteOptions,
): Promise<void> {
  const { composerService, defaultProjectId } = options;

  app.get<{ Querystring: ComposerListQuery }>('/composer/assets', async (request, reply) => {
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
      limit: parseLimit(request.query.limit),
      offset: parseOffset(request.query.offset),
    });

    return reply.status(200).send(result);
  });

  app.get<{ Params: { id: string }; Querystring: { projectId?: string } }>(
    '/composer/assets/:id',
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

  app.post<{ Body: ComposerValidateBody }>('/composer/validate', async (request, reply) => {
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

    return reply.status(200).send(result);
  });
}

export type {
  ComposerAssetDetail,
  ComposerAssetListResult,
  ComposerValidateResult,
} from '../composer/types.js';
