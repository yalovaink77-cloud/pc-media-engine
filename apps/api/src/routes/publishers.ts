import type { FastifyInstance } from 'fastify';

import { auditRecord } from '../audit/helpers.js';
import type { AuditService } from '../audit/types.js';
import type { AuthMiddleware } from '../auth/middleware.js';
import type { PublisherManagementService } from '../publishers/types.js';

export type PublishersRouteOptions = {
  publisherService?: PublisherManagementService;
  authMiddleware?: AuthMiddleware;
  auditService?: AuditService;
};

const CAPABILITIES_SCHEMA = {
  type: 'object',
  properties: {
    mediaUpload: { type: 'boolean' },
    postCreation: { type: 'boolean' },
    drafts: { type: 'boolean' },
    tags: { type: 'boolean' },
    categories: { type: 'boolean' },
    featuredImages: { type: 'boolean' },
    scheduling: { type: 'boolean' },
    update: { type: 'boolean' },
    delete: { type: 'boolean' },
  },
} as const;

const CONFIG_REQUIREMENT_SCHEMA = {
  type: 'object',
  properties: {
    envVar: { type: 'string' },
    required: { type: 'boolean' },
    description: { type: 'string' },
  },
} as const;

const PUBLISHER_LIST_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    displayName: { type: 'string' },
    version: { type: 'string' },
    enabled: { type: 'boolean' },
    capabilities: CAPABILITIES_SCHEMA,
    supportsHealthCheck: { type: 'boolean' },
  },
} as const;

export async function publishersRoutes(
  app: FastifyInstance,
  options: PublishersRouteOptions,
): Promise<void> {
  const { publisherService, authMiddleware, auditService } = options;
  const readGuard = authMiddleware ? [authMiddleware.requirePermission('publishers:read')] : [];

  app.get('/publishers', {
    preHandler: readGuard,
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            publishers: { type: 'array', items: PUBLISHER_LIST_ITEM_SCHEMA },
            count: { type: 'number' },
          },
        },
        503: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
    handler: async (_request, reply) => {
      if (!publisherService) {
        return reply.status(503).send({ error: 'Publisher management unavailable' });
      }
      const publishers = publisherService.listPublishers();
      return reply.status(200).send({ publishers, count: publishers.length });
    },
  });

  app.get<{ Params: { id: string } }>('/publishers/:id', {
    preHandler: readGuard,
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            displayName: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            homepageUrl: { type: 'string' },
            enabled: { type: 'boolean' },
            capabilities: CAPABILITIES_SCHEMA,
            supportsHealthCheck: { type: 'boolean' },
            configurationRequirements: {
              type: 'array',
              items: CONFIG_REQUIREMENT_SCHEMA,
            },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        503: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
    handler: async (request, reply) => {
      if (!publisherService) {
        return reply.status(503).send({ error: 'Publisher management unavailable' });
      }
      const publisher = publisherService.getPublisher(request.params.id);
      if (!publisher) {
        return reply.status(404).send({ error: `Publisher "${request.params.id}" not found` });
      }
      return reply.status(200).send(publisher);
    },
  });

  app.get<{ Params: { id: string } }>('/publishers/:id/health', {
    preHandler: readGuard,
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            healthy: { type: 'boolean' },
            latency: { type: 'number' },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        503: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
    handler: async (request, reply) => {
      if (!publisherService) {
        return reply.status(503).send({ error: 'Publisher management unavailable' });
      }
      const registration = publisherService.getPublisher(request.params.id);
      if (!registration) {
        return reply.status(404).send({ error: `Publisher "${request.params.id}" not found` });
      }
      const health = await publisherService.checkHealth(request.params.id);
      auditRecord(
        auditService,
        {
          type: 'provider.health_check',
          severity: health.healthy ? 'info' : 'warn',
          target: { type: 'publisher', id: request.params.id },
          metadata: { healthy: health.healthy, latency: health.latency, message: health.message },
        },
        request,
      );
      return reply.status(200).send(health);
    },
  });
}
