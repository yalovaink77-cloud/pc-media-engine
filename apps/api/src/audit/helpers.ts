/**
 * Audit recording helpers — Sprint 46.
 */

import type { FastifyRequest } from 'fastify';

import type { AuthContext } from '../auth/middleware.js';
import type { ComposerBulkPublishResult, ComposerPublishResult } from '../composer/types.js';
import type { AuditActor, AuditEventInput, AuditService } from './types.js';

export function actorFromRequest(request: FastifyRequest): AuditActor {
  const auth = request.auth;
  if (!auth) {
    return { type: 'anonymous', id: 'anonymous' };
  }
  if (auth.type === 'jwt') {
    return { type: 'user', id: auth.sub || 'unknown', role: auth.role };
  }
  return { type: 'user', id: auth.keyPrefix, role: auth.role };
}

export function actorFromAuth(auth: AuthContext | undefined): AuditActor {
  if (!auth) return { type: 'anonymous', id: 'anonymous' };
  if (auth.type === 'jwt') {
    return { type: 'user', id: auth.sub || 'unknown', role: auth.role };
  }
  return { type: 'user', id: auth.keyPrefix, role: auth.role };
}

export function systemActor(): AuditActor {
  return { type: 'system', id: 'api' };
}

export function auditRecord(
  auditService: AuditService | undefined,
  input: AuditEventInput,
  request?: FastifyRequest,
): void {
  if (!auditService) return;
  auditService.record({
    ...input,
    actor: input.actor ?? (request ? actorFromRequest(request) : systemActor()),
    correlationId: input.correlationId ?? request?.id,
  });
}

export function auditPublishResult(
  auditService: AuditService | undefined,
  request: FastifyRequest,
  assetId: string,
  result: ComposerPublishResult,
): void {
  if (!auditService) return;
  const base = {
    actor: actorFromRequest(request),
    correlationId: request.id,
    target: { type: 'asset', id: assetId },
  };

  auditService.record({
    ...base,
    type: 'publishing.requested',
    severity: 'info',
    metadata: { publisherIds: result.accepted.map((a) => a.publisherId) },
  });
  auditService.record({
    ...base,
    type: 'composer.publish',
    severity: 'info',
    metadata: {
      accepted: result.accepted.length,
      skipped: result.skipped.length,
      failures: result.failures.length,
    },
  });

  for (const item of result.accepted) {
    auditService.record({
      ...base,
      type: 'publishing.queued',
      severity: 'info',
      target: { type: 'publisher', id: item.publisherId },
      metadata: { jobId: item.jobId, assetId },
    });
  }
  for (const item of result.skipped) {
    auditService.record({
      ...base,
      type: 'publishing.duplicate_skipped',
      severity: 'warn',
      target: { type: 'publisher', id: item.publisherId },
      metadata: { reason: item.reason, assetId },
    });
  }
  for (const item of result.failures) {
    auditService.record({
      ...base,
      type: 'publishing.failed',
      severity: 'error',
      target: { type: 'publisher', id: item.publisherId },
      metadata: { reason: item.reason, assetId },
    });
  }
}

export function auditBulkPublishResult(
  auditService: AuditService | undefined,
  request: FastifyRequest,
  result: ComposerBulkPublishResult,
): void {
  if (!auditService) return;
  auditService.record({
    type: 'composer.bulk_publish',
    severity: 'info',
    actor: actorFromRequest(request),
    correlationId: request.id,
    metadata: { summary: result.summary },
  });
  for (const item of result.accepted) {
    auditService.record({
      type: 'publishing.queued',
      severity: 'info',
      actor: actorFromRequest(request),
      correlationId: request.id,
      target: { type: 'publisher', id: item.publisherId },
      metadata: { jobId: item.jobId, assetId: item.assetId },
    });
  }
  for (const item of result.skipped) {
    auditService.record({
      type: 'publishing.duplicate_skipped',
      severity: 'warn',
      actor: actorFromRequest(request),
      correlationId: request.id,
      target: { type: 'publisher', id: item.publisherId },
      metadata: { reason: item.reason, assetId: item.assetId },
    });
  }
  for (const item of result.failures) {
    auditService.record({
      type: 'publishing.failed',
      severity: 'error',
      actor: actorFromRequest(request),
      correlationId: request.id,
      target: { type: 'publisher', id: item.publisherId },
      metadata: { reason: item.reason, assetId: item.assetId },
    });
  }
}
