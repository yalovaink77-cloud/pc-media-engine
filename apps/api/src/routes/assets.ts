/**
 * Asset Library API routes — Sprint 39.
 *
 * Read-only asset browsing. No upload or mutation endpoints.
 *
 * Routes:
 *   GET /assets
 *   GET /assets/:id
 *   GET /assets/:id/download
 *   GET /assets/:id/thumbnail
 */

import type { StorageProvider } from '@pcme/media';
import type { FastifyInstance, FastifyReply } from 'fastify';

import type { AssetLibraryService } from '../assets/types.js';
import { DEFAULT_ASSET_LIMIT, isAssetStatus, MAX_ASSET_LIMIT } from '../assets/types.js';
import type { AuthMiddleware } from '../auth/middleware.js';
import { clampLimit, clampOffset } from '../pagination.js';

export type AssetsRouteOptions = {
  assetLibrary?: AssetLibraryService;
  storageProvider?: StorageProvider;
  defaultProjectId: string;
  authMiddleware?: AuthMiddleware;
};

type AssetsListQuery = {
  projectId?: string;
  status?: string;
  mimeType?: string;
  limit?: string;
  offset?: string;
};

async function serviceUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Asset library is not available (database not configured)',
    statusCode: 503,
  });
}

async function notFound(reply: FastifyReply, message: string): Promise<void> {
  await reply.status(404).send({ error: 'Not Found', message, statusCode: 404 });
}

export async function assetsRoutes(
  app: FastifyInstance,
  options: AssetsRouteOptions,
): Promise<void> {
  const { assetLibrary, storageProvider, defaultProjectId, authMiddleware } = options;
  const readGuard = authMiddleware ? [authMiddleware.requirePermission('assets:read')] : [];

  app.get<{ Querystring: AssetsListQuery }>(
    '/assets',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!assetLibrary) return serviceUnavailable(reply);

      const { status, mimeType, limit, offset } = request.query;
      const projectId = request.query.projectId ?? defaultProjectId;

      if (!projectId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId is required (or set PCME_DEFAULT_PROJECT_ID)',
          statusCode: 400,
        });
      }

      if (status && !isAssetStatus(status)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid status "${status}". Allowed: pending, processing, ready, failed`,
          statusCode: 400,
        });
      }

      const result = await assetLibrary.listAssets({
        projectId,
        status,
        mimeType,
        limit: clampLimit(limit, DEFAULT_ASSET_LIMIT, MAX_ASSET_LIMIT),
        offset: clampOffset(offset),
      });

      return reply.status(200).send(result);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { projectId?: string } }>(
    '/assets/:id',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!assetLibrary) return serviceUnavailable(reply);

      const projectId = request.query.projectId ?? defaultProjectId;
      if (!projectId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'projectId is required',
          statusCode: 400,
        });
      }

      const asset = await assetLibrary.getAsset(projectId, request.params.id);
      if (!asset) return notFound(reply, `Asset "${request.params.id}" not found`);

      return reply.status(200).send(asset);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { projectId?: string } }>(
    '/assets/:id/download',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!assetLibrary || !storageProvider) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: 'Download unavailable',
          statusCode: 503,
        });
      }

      const projectId = request.query.projectId ?? defaultProjectId;
      const storageKey = await assetLibrary.getAssetStorageKey(projectId, request.params.id);
      if (!storageKey) return notFound(reply, `Asset "${request.params.id}" not found`);

      try {
        const exists = await storageProvider.exists(storageKey);
        if (!exists) {
          return notFound(reply, 'Asset file not found in storage');
        }
        const buffer = await storageProvider.get(storageKey);
        const asset = await assetLibrary.getAsset(projectId, request.params.id);
        const mimeType = asset?.mimeType ?? 'application/octet-stream';
        const filename = asset?.filename ?? request.params.id;
        return reply
          .status(200)
          .header('content-type', mimeType)
          .header('content-disposition', `attachment; filename="${filename}"`)
          .send(buffer);
      } catch {
        return notFound(reply, 'Asset file not found in storage');
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { projectId?: string } }>(
    '/assets/:id/thumbnail',
    { preHandler: readGuard },
    async (request, reply) => {
      if (!assetLibrary || !storageProvider) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: 'Thumbnail unavailable',
          statusCode: 503,
        });
      }

      const projectId = request.query.projectId ?? defaultProjectId;
      const storageKey = await assetLibrary.getThumbnailStorageKey(projectId, request.params.id);
      if (!storageKey) return notFound(reply, 'Thumbnail not found');

      try {
        const exists = await storageProvider.exists(storageKey);
        if (!exists) return notFound(reply, 'Thumbnail file not found in storage');
        const buffer = await storageProvider.get(storageKey);
        return reply.status(200).header('content-type', 'image/webp').send(buffer);
      } catch {
        return notFound(reply, 'Thumbnail file not found in storage');
      }
    },
  );
}

export type { AssetDetail, AssetListResult } from '../assets/types.js';
