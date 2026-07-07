import type { PublishedContent } from '@pcme/database';
import type { FastifyInstance } from 'fastify';

import type { Config } from '../config.js';
import { parseStrictLimit } from '../pagination.js';

// ---------------------------------------------------------------------------
// Injection interface
// ---------------------------------------------------------------------------

export interface PublishedContentFinder {
  findHistory(opts: {
    projectId?: string;
    assetId?: string;
    publisher?: string;
    limit: number;
  }): Promise<PublishedContent[]>;

  findById(id: string): Promise<PublishedContent | null>;
}

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export type PublishingRouteOptions = {
  /**
   * Injected repository for data access.
   * When undefined, history/detail endpoints return 503.
   */
  publishedContentRepo?: PublishedContentFinder;
  /**
   * Subset of Config used by the /health endpoint.
   * Pass the full Config object; extra fields are ignored.
   */
  publishingConfig: Pick<
    Config,
    | 'version'
    | 'publisherDriver'
    | 'autoEnqueuePublishing'
    | 'publishingMaxRetries'
    | 'publishingBackoffMs'
    | 'aiMetadataProvider'
  >;
};

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

const HISTORY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    projectId: { type: 'string' },
    assetId: { type: 'string' },
    publisher: { type: 'string' },
    externalId: { type: 'string' },
    url: { type: 'string' },
    status: { type: 'string' },
    publishedAt: { type: 'string' },
    createdAt: { type: 'string' },
  },
} as const;

export type HistoryItem = {
  id: string;
  projectId: string;
  assetId: string;
  publisher: string;
  externalId: string;
  url: string;
  status: string;
  publishedAt: string;
  createdAt: string;
};

export type HistoryResponse = {
  items: HistoryItem[];
  count: number;
};

export type PublishingHealthResponse = {
  status: 'ok';
  publisherDriver: string;
  queueEnabled: boolean;
  retryConfig: { maxRetries: number; backoffMs: number };
  schedulerEnabled: boolean;
  duplicateDetectionEnabled: boolean;
  aiMetadataProvider: string;
  workerVersion: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toHistoryItem(record: PublishedContent): HistoryItem {
  return {
    id: record.id,
    projectId: record.projectId,
    assetId: record.assetId,
    publisher: record.publisher,
    externalId: record.externalId,
    url: record.url,
    status: record.status,
    publishedAt: record.publishedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function publishingRoutes(
  app: FastifyInstance,
  options: PublishingRouteOptions,
): Promise<void> {
  const { publishedContentRepo, publishingConfig } = options;

  // -------------------------------------------------------------------------
  // GET /publishing/health
  //   Must be registered before /:id to avoid "health" matching as an id param.
  // -------------------------------------------------------------------------
  app.get<{ Reply: PublishingHealthResponse }>(
    '/publishing/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              publisherDriver: { type: 'string' },
              queueEnabled: { type: 'boolean' },
              retryConfig: {
                type: 'object',
                properties: {
                  maxRetries: { type: 'number' },
                  backoffMs: { type: 'number' },
                },
              },
              schedulerEnabled: { type: 'boolean' },
              duplicateDetectionEnabled: { type: 'boolean' },
              aiMetadataProvider: { type: 'string' },
              workerVersion: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const body: PublishingHealthResponse = {
        status: 'ok',
        publisherDriver: publishingConfig.publisherDriver ?? 'mock',
        queueEnabled: publishingConfig.autoEnqueuePublishing ?? false,
        retryConfig: {
          maxRetries: publishingConfig.publishingMaxRetries ?? 3,
          backoffMs: publishingConfig.publishingBackoffMs ?? 5000,
        },
        schedulerEnabled: true,
        duplicateDetectionEnabled: true,
        aiMetadataProvider: publishingConfig.aiMetadataProvider ?? 'none',
        workerVersion: publishingConfig.version,
      };
      return reply.status(200).send(body);
    },
  );

  // -------------------------------------------------------------------------
  // GET /publishing/history
  // -------------------------------------------------------------------------
  app.get<{
    Querystring: { projectId?: string; assetId?: string; publisher?: string; limit?: string };
    Reply: HistoryResponse | { error: string; statusCode: number };
  }>(
    '/publishing/history',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            assetId: { type: 'string' },
            publisher: { type: 'string' },
            limit: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array', items: HISTORY_ITEM_SCHEMA },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!publishedContentRepo) {
        return reply.status(503).send({ statusCode: 503, error: 'Repository not configured' });
      }

      const { projectId, assetId, publisher, limit: rawLimit } = request.query;

      const limitResult = parseStrictLimit(rawLimit, MAX_LIMIT, DEFAULT_LIMIT);
      if (limitResult.error) {
        return reply.status(400).send({ statusCode: 400, error: limitResult.error });
      }

      const records = await publishedContentRepo.findHistory({
        projectId: projectId?.trim() || undefined,
        assetId: assetId?.trim() || undefined,
        publisher: publisher?.trim() || undefined,
        limit: limitResult.value,
      });

      const items = records.map(toHistoryItem);
      return reply.status(200).send({ items, count: items.length });
    },
  );

  // -------------------------------------------------------------------------
  // GET /publishing/:id
  // -------------------------------------------------------------------------
  app.get<{
    Params: { id: string };
    Reply: HistoryItem | { error: string; statusCode: number };
  }>(
    '/publishing/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: HISTORY_ITEM_SCHEMA,
        },
      },
    },
    async (request, reply) => {
      if (!publishedContentRepo) {
        return reply.status(503).send({ statusCode: 503, error: 'Repository not configured' });
      }

      const { id } = request.params;
      const record = await publishedContentRepo.findById(id);

      if (!record) {
        return reply
          .status(404)
          .send({ statusCode: 404, error: `PublishedContent ${id} not found` });
      }

      return reply.status(200).send(toHistoryItem(record));
    },
  );
}
