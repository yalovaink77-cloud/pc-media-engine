import type {
  ProjectScopedPersistenceContext,
  PublishingIdempotencyRecord,
  PublishingIdempotencyRepository,
  PublishingIdempotencyReserveResult,
  ReservePublishingIdempotencyInput,
} from '@pcme/shared';
import {
  buildPublishingIdempotencyKey,
  PublishingIdempotencyConflictError,
  PublishingIdempotencyNotFoundError,
} from '@pcme/shared';
import type { PrismaClient, PublishingIdempotencyRecord as DbRecord } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import {
  fromDbPublishingIdempotencyStatus,
  toDbPublishingIdempotencyStatus,
} from '../domain/publishing-outbox-validation.js';
import { requireOrganizationId, requireProjectId } from './scoped-query.js';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function mapRecord(record: DbRecord): PublishingIdempotencyRecord {
  return Object.freeze({
    idempotencyKey: record.idempotencyKey,
    targetId: record.targetId,
    handoffId: record.handoffId,
    requestHash: record.requestHash,
    status: fromDbPublishingIdempotencyStatus(record.status),
    remoteContentId: record.remoteContentId ?? undefined,
    remoteUrl: record.remoteUrl ?? undefined,
    firstSeenAt: record.firstSeenAt.toISOString(),
    lastSeenAt: record.lastSeenAt.toISOString(),
    completedAt: record.completedAt?.toISOString(),
    expiresAt: record.expiresAt?.toISOString(),
  });
}

export class PrismaPublishingIdempotencyRepository implements PublishingIdempotencyRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  async reserve(
    context: ProjectScopedPersistenceContext,
    input: ReservePublishingIdempotencyInput,
  ): Promise<PublishingIdempotencyReserveResult> {
    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);
    const idempotencyKey = buildPublishingIdempotencyKey(input.targetId, input.handoffId);
    const now = input.now ?? new Date();
    const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
    const expiresAt = new Date(now.getTime() + ttlMs);

    return this.client.$transaction(async (tx) => {
      const existing = await tx.publishingIdempotencyRecord.findFirst({
        where: { projectId, idempotencyKey },
      });

      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          throw new PublishingIdempotencyConflictError(idempotencyKey);
        }

        if (existing.status === 'completed') {
          return Object.freeze({
            action: 'return-existing' as const,
            record: mapRecord(existing),
          });
        }

        if (existing.status === 'reserved') {
          if (existing.expiresAt && existing.expiresAt.getTime() <= now.getTime()) {
            await tx.publishingIdempotencyRecord.update({
              where: { id: existing.id },
              data: {
                status: 'reserved',
                lastSeenAt: now,
                expiresAt,
              },
            });
            return Object.freeze({ action: 'proceed' as const });
          }

          return Object.freeze({
            action: 'blocked' as const,
            reason: 'Publish reservation already in progress',
          });
        }

        if (existing.status === 'failed' || existing.status === 'expired') {
          await tx.publishingIdempotencyRecord.update({
            where: { id: existing.id },
            data: {
              status: 'reserved',
              lastSeenAt: now,
              expiresAt,
            },
          });
          return Object.freeze({ action: 'proceed' as const });
        }
      }

      try {
        await tx.publishingIdempotencyRecord.create({
          data: {
            organizationId,
            projectId,
            idempotencyKey,
            targetId: input.targetId,
            handoffId: input.handoffId,
            requestHash: input.requestHash,
            status: 'reserved',
            firstSeenAt: now,
            lastSeenAt: now,
            expiresAt,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const raced = await tx.publishingIdempotencyRecord.findFirstOrThrow({
            where: { projectId, idempotencyKey },
          });
          if (raced.requestHash !== input.requestHash) {
            throw new PublishingIdempotencyConflictError(idempotencyKey);
          }
          if (raced.status === 'completed') {
            return Object.freeze({
              action: 'return-existing' as const,
              record: mapRecord(raced),
            });
          }
          return Object.freeze({
            action: 'blocked' as const,
            reason: 'Publish reservation already in progress',
          });
        }
        throw error;
      }

      return Object.freeze({ action: 'proceed' as const });
    });
  }

  async get(
    context: ProjectScopedPersistenceContext,
    idempotencyKey: string,
  ): Promise<PublishingIdempotencyRecord | undefined> {
    const record = await this.client.publishingIdempotencyRecord.findFirst({
      where: {
        projectId: requireProjectId(context.projectId),
        idempotencyKey,
      },
    });
    return record ? mapRecord(record) : undefined;
  }

  async markCompleted(
    context: ProjectScopedPersistenceContext,
    input: {
      idempotencyKey: string;
      remoteContentId?: string;
      remoteUrl?: string;
      now?: Date;
    },
  ): Promise<PublishingIdempotencyRecord> {
    const projectId = requireProjectId(context.projectId);
    const now = input.now ?? new Date();

    const updated = await this.client.publishingIdempotencyRecord.updateMany({
      where: { projectId, idempotencyKey: input.idempotencyKey },
      data: {
        status: 'completed',
        remoteContentId: input.remoteContentId,
        remoteUrl: input.remoteUrl,
        completedAt: now,
        lastSeenAt: now,
      },
    });

    if (updated.count === 0) {
      throw new PublishingIdempotencyNotFoundError(input.idempotencyKey);
    }

    const record = await this.client.publishingIdempotencyRecord.findFirstOrThrow({
      where: { projectId, idempotencyKey: input.idempotencyKey },
    });
    return mapRecord(record);
  }

  async markFailed(
    context: ProjectScopedPersistenceContext,
    input: { idempotencyKey: string; retryable: boolean; now?: Date },
  ): Promise<PublishingIdempotencyRecord> {
    const projectId = requireProjectId(context.projectId);
    const now = input.now ?? new Date();

    const updated = await this.client.publishingIdempotencyRecord.updateMany({
      where: { projectId, idempotencyKey: input.idempotencyKey },
      data: {
        status: input.retryable ? 'failed' : 'completed',
        lastSeenAt: now,
      },
    });

    if (updated.count === 0) {
      throw new PublishingIdempotencyNotFoundError(input.idempotencyKey);
    }

    const record = await this.client.publishingIdempotencyRecord.findFirstOrThrow({
      where: { projectId, idempotencyKey: input.idempotencyKey },
    });
    return mapRecord(record);
  }

  async releaseExpired(
    context: ProjectScopedPersistenceContext,
    now: Date = new Date(),
  ): Promise<number> {
    const result = await this.client.publishingIdempotencyRecord.updateMany({
      where: {
        projectId: requireProjectId(context.projectId),
        status: 'reserved',
        expiresAt: { lte: now },
      },
      data: {
        status: toDbPublishingIdempotencyStatus('expired'),
      },
    });

    return result.count;
  }
}

export { buildPublishingIdempotencyKey };
