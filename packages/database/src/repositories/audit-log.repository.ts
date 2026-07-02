import type { AuditLogEntry, Prisma, PrismaClient } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import { requireOrganizationId, requireProjectId } from './scoped-query.js';

export type AuditAction =
  | 'content_created'
  | 'content_updated'
  | 'lifecycle_changed'
  | 'media_uploaded'
  | 'publish_attempted'
  | 'publish_succeeded'
  | 'publish_failed'
  | 'integration_changed'
  | 'ai_job_completed'
  | 'ai_job_failed';

export interface ActorRef {
  type: 'user' | 'system';
  id: string;
}

export interface AppendAuditLogInput {
  organizationId: string;
  projectId: string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  actor: ActorRef;
  metadata?: Record<string, unknown>;
}

export class AuditLogRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  append(input: AppendAuditLogInput): Promise<AuditLogEntry> {
    return this.client.auditLogEntry.create({
      data: {
        organizationId: requireOrganizationId(input.organizationId),
        projectId: requireProjectId(input.projectId),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actor: input.actor as unknown as Prisma.InputJsonValue,
        metadata: (input.metadata ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      },
    });
  }

  listByProject(
    projectId: string,
    options?: { limit?: number; entityType?: string; entityId?: string },
  ): Promise<AuditLogEntry[]> {
    const scopedProjectId = requireProjectId(projectId);

    return this.client.auditLogEntry.findMany({
      where: {
        projectId: scopedProjectId,
        ...(options?.entityType ? { entityType: options.entityType } : {}),
        ...(options?.entityId ? { entityId: options.entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
    });
  }
}

/** Append-only audit log helper. */
export async function appendAuditLog(
  input: AppendAuditLogInput,
  client: PrismaClient = getPrismaClient(),
): Promise<AuditLogEntry> {
  return new AuditLogRepository(client).append(input);
}

export type { AuditLogEntry };
