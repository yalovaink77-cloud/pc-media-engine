/**
 * Provider configuration API routes — Sprint 44.
 *
 * Routes:
 *   GET  /providers/config
 *   GET  /providers/config/:providerId
 *   POST /providers/config/:providerId/validate
 *   PUT  /providers/config/:providerId
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

import { auditRecord } from '../audit/helpers.js';
import type { AuditService } from '../audit/types.js';
import type { AuthMiddleware } from '../auth/middleware.js';
import type { ProviderConfigService } from '../providers/types.js';

export type ProviderConfigRouteOptions = {
  providerConfigService?: ProviderConfigService;
  authMiddleware?: AuthMiddleware;
  auditService?: AuditService;
};

const CONFIG_FIELD_SCHEMA = {
  type: 'object',
  properties: {
    envVar: { type: 'string' },
    description: { type: 'string' },
    required: { type: 'boolean' },
    configured: { type: 'boolean' },
    value: { type: 'string' },
    masked: { type: 'string' },
  },
} as const;

const CONFIG_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    displayName: { type: 'string' },
    enabled: { type: 'boolean' },
    configured: { type: 'boolean' },
    configurationStatus: { type: 'string', enum: ['complete', 'partial', 'missing'] },
    requiredFields: { type: 'array', items: CONFIG_FIELD_SCHEMA },
    optionalFields: { type: 'array', items: CONFIG_FIELD_SCHEMA },
    supportsHotReload: { type: 'boolean' },
  },
} as const;

const VALIDATION_SCHEMA = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    errors: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const;

async function serviceUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Provider configuration management is not available',
    statusCode: 503,
  });
}

function isValidationResult(body: unknown): body is { valid: boolean; errors: string[] } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'valid' in body &&
    (body as { valid: unknown }).valid === false &&
    'errors' in body
  );
}

export async function providerConfigRoutes(
  app: FastifyInstance,
  options: ProviderConfigRouteOptions,
): Promise<void> {
  const { providerConfigService, authMiddleware, auditService } = options;
  const readPreHandler = authMiddleware ? [authMiddleware.requirePermission('providers:read')] : [];
  const writePreHandler = authMiddleware
    ? [authMiddleware.requirePermission('providers:write')]
    : [];

  app.get(
    '/providers/config',
    {
      preHandler: readPreHandler,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              providers: { type: 'array', items: CONFIG_SUMMARY_SCHEMA },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      if (!providerConfigService) return serviceUnavailable(reply);
      const result = providerConfigService.listConfigs();
      return reply.status(200).send(result);
    },
  );

  app.get<{ Params: { providerId: string } }>(
    '/providers/config/:providerId',
    { preHandler: readPreHandler },
    async (request, reply) => {
      if (!providerConfigService) return serviceUnavailable(reply);
      const config = providerConfigService.getConfig(request.params.providerId);
      if (!config) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Provider "${request.params.providerId}" not found`,
          statusCode: 404,
        });
      }
      return reply.status(200).send(config);
    },
  );

  app.post<{ Params: { providerId: string }; Body: Record<string, string | undefined> }>(
    '/providers/config/:providerId/validate',
    {
      preHandler: writePreHandler,
      schema: {
        response: {
          200: VALIDATION_SCHEMA,
        },
      },
    },
    async (request, reply) => {
      if (!providerConfigService) return serviceUnavailable(reply);
      const { providerId } = request.params;
      const detail = providerConfigService.getConfig(providerId);
      if (!detail) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Provider "${providerId}" not found`,
          statusCode: 404,
        });
      }
      const result = providerConfigService.validateConfig(providerId, request.body ?? {});
      auditRecord(
        auditService,
        {
          type: 'provider.validation',
          severity: result.valid ? 'info' : 'warn',
          target: { type: 'provider', id: providerId },
          metadata: { valid: result.valid, errors: result.errors },
        },
        request,
      );
      return reply.status(200).send(result);
    },
  );

  app.put<{ Params: { providerId: string }; Body: Record<string, string | undefined> }>(
    '/providers/config/:providerId',
    {
      preHandler: writePreHandler,
      schema: {
        response: {
          200: {
            ...CONFIG_SUMMARY_SCHEMA,
            properties: {
              ...CONFIG_SUMMARY_SCHEMA.properties,
              version: { type: 'string' },
              description: { type: 'string' },
              validation: VALIDATION_SCHEMA,
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
              ...VALIDATION_SCHEMA.properties,
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!providerConfigService) return serviceUnavailable(reply);
      const { providerId } = request.params;
      const existing = providerConfigService.getConfig(providerId);
      if (!existing) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Provider "${providerId}" not found`,
          statusCode: 404,
        });
      }

      const result = providerConfigService.updateConfig(providerId, request.body ?? {});
      if (!result) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Provider "${providerId}" not found`,
          statusCode: 404,
        });
      }
      if (isValidationResult(result)) {
        auditRecord(
          auditService,
          {
            type: 'provider.config_updated',
            severity: 'warn',
            target: { type: 'provider', id: providerId },
            metadata: { success: false, errors: result.errors },
          },
          request,
        );
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Configuration validation failed',
          statusCode: 400,
          ...result,
        });
      }
      auditRecord(
        auditService,
        {
          type: 'provider.config_updated',
          severity: 'info',
          target: { type: 'provider', id: providerId },
          metadata: { success: true },
        },
        request,
      );
      return reply.status(200).send(result);
    },
  );
}
