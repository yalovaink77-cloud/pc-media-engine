import type { PublishedContent } from '@pcme/database';
import type { FastifyInstance } from 'fastify';

import type { Config } from '../config.js';
import type { DatabaseStatus } from './health.js';

// ---------------------------------------------------------------------------
// Injection interface
// ---------------------------------------------------------------------------

export type DashboardSummaryStats = {
  totalPublished: number;
  totalDrafts: number;
  totalFailed: number;
  latestPublishedAt: Date | null;
  publishers: Array<{ publisher: string; count: number }>;
};

export interface DashboardDataProvider {
  getSummaryStats(): Promise<DashboardSummaryStats>;
  findRecent(limit: number): Promise<PublishedContent[]>;
}

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export type DashboardRouteOptions = {
  /**
   * Injected data provider for summary and recent queries.
   * When absent, summary/recent endpoints return 503.
   */
  repo?: DashboardDataProvider;
  /**
   * Optional database liveness check (reused from health route).
   * When absent, the health endpoint reports database as "skipped".
   */
  checkDatabase?: () => Promise<DatabaseStatus>;
  publishingConfig: Pick<
    Config,
    | 'version'
    | 'env'
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

const RECENT_ITEM_SCHEMA = {
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

export type RecentItem = {
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

export type DashboardSummaryResponse = {
  totalPublished: number;
  totalDrafts: number;
  totalFailed: number;
  latestPublishedAt: string | null;
  publishers: Array<{ publisher: string; count: number }>;
  duplicateDetectionEnabled: boolean;
  schedulerEnabled: boolean;
  retryEnabled: boolean;
  aiProvider: string;
  publisherDriver: string;
};

export type DashboardRecentResponse = {
  items: RecentItem[];
  count: number;
};

export type DashboardHealthResponse = {
  status: 'ok';
  database: DatabaseStatus;
  publishing: {
    publisherDriver: string;
    queueEnabled: boolean;
    retryConfig: { maxRetries: number; backoffMs: number };
  };
  version: string;
  env: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RECENT_LIMIT = 10;
const MAX_RECENT_LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRecentItem(r: PublishedContent): RecentItem {
  return {
    id: r.id,
    projectId: r.projectId,
    assetId: r.assetId,
    publisher: r.publisher,
    externalId: r.externalId,
    url: r.url,
    status: r.status,
    publishedAt: r.publishedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

function parseLimit(raw: unknown, max: number, def: number): { value: number; error?: string } {
  if (raw === undefined || raw === null) return { value: def };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { value: 0, error: 'limit must be a positive integer' };
  if (n > max) return { value: 0, error: `limit must not exceed ${max}` };
  return { value: n };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function dashboardRoutes(
  app: FastifyInstance,
  options: DashboardRouteOptions,
): Promise<void> {
  const { repo, checkDatabase, publishingConfig } = options;

  // -------------------------------------------------------------------------
  // GET /dashboard/health
  // -------------------------------------------------------------------------
  app.get<{ Reply: DashboardHealthResponse }>(
    '/dashboard/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              database: { type: 'string' },
              publishing: {
                type: 'object',
                properties: {
                  publisherDriver: { type: 'string' },
                  queueEnabled: { type: 'boolean' },
                  retryConfig: {
                    type: 'object',
                    properties: {
                      maxRetries: { type: 'number' },
                      backoffMs: { type: 'number' },
                    },
                  },
                },
              },
              version: { type: 'string' },
              env: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const database: DatabaseStatus = checkDatabase ? await checkDatabase() : 'skipped';

      const body: DashboardHealthResponse = {
        status: 'ok',
        database,
        publishing: {
          publisherDriver: publishingConfig.publisherDriver ?? 'mock',
          queueEnabled: publishingConfig.autoEnqueuePublishing ?? false,
          retryConfig: {
            maxRetries: publishingConfig.publishingMaxRetries ?? 3,
            backoffMs: publishingConfig.publishingBackoffMs ?? 5000,
          },
        },
        version: publishingConfig.version,
        env: publishingConfig.env,
      };

      return reply.status(200).send(body);
    },
  );

  // -------------------------------------------------------------------------
  // GET /dashboard/summary
  // -------------------------------------------------------------------------
  app.get<{ Reply: DashboardSummaryResponse | { error: string; statusCode: number } }>(
    '/dashboard/summary',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              totalPublished: { type: 'number' },
              totalDrafts: { type: 'number' },
              totalFailed: { type: 'number' },
              latestPublishedAt: { type: ['string', 'null'] },
              publishers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    publisher: { type: 'string' },
                    count: { type: 'number' },
                  },
                },
              },
              duplicateDetectionEnabled: { type: 'boolean' },
              schedulerEnabled: { type: 'boolean' },
              retryEnabled: { type: 'boolean' },
              aiProvider: { type: 'string' },
              publisherDriver: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      if (!repo) {
        return reply.status(503).send({ statusCode: 503, error: 'Repository not configured' });
      }

      const stats = await repo.getSummaryStats();

      const body: DashboardSummaryResponse = {
        totalPublished: stats.totalPublished,
        totalDrafts: stats.totalDrafts,
        totalFailed: stats.totalFailed,
        latestPublishedAt: stats.latestPublishedAt?.toISOString() ?? null,
        publishers: stats.publishers,
        duplicateDetectionEnabled: true,
        schedulerEnabled: true,
        retryEnabled: true,
        aiProvider: publishingConfig.aiMetadataProvider ?? 'none',
        publisherDriver: publishingConfig.publisherDriver ?? 'mock',
      };

      return reply.status(200).send(body);
    },
  );

  // -------------------------------------------------------------------------
  // GET /dashboard/recent
  // -------------------------------------------------------------------------
  app.get<{
    Querystring: { limit?: string };
    Reply: DashboardRecentResponse | { error: string; statusCode: number };
  }>(
    '/dashboard/recent',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: { limit: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array', items: RECENT_ITEM_SCHEMA },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!repo) {
        return reply.status(503).send({ statusCode: 503, error: 'Repository not configured' });
      }

      const limitResult = parseLimit(request.query.limit, MAX_RECENT_LIMIT, DEFAULT_RECENT_LIMIT);
      if (limitResult.error) {
        return reply.status(400).send({ statusCode: 400, error: limitResult.error });
      }

      const records = await repo.findRecent(limitResult.value);
      const items = records.map(toRecentItem);
      return reply.status(200).send({ items, count: items.length });
    },
  );
}
