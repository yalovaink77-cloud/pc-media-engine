import type {
  IngestionJob,
  IngestionSource,
  IngestionSourceType,
  IngestionStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

import { getPrismaClient } from '../client.js';
import {
  validateIngestionCounts,
  validateIngestionSourceUri,
  validateNonNegativeCount,
  validateSourceIdentifier,
} from '../domain/ingestion-validation.js';
import { activeRecordsFilter, requireProjectId } from './scoped-query.js';

export type CreateIngestionSourceInput = {
  organizationId: string;
  projectId: string;
  sourceType: IngestionSourceType;
  sourceUri: string;
  sourceLabel?: string;
  isEnabled?: boolean;
  config?: Prisma.InputJsonValue;
};

export type UpdateIngestionSourceInput = {
  sourceLabel?: string | null;
  isEnabled?: boolean;
  config?: Prisma.InputJsonValue;
};

export type CreateIngestionJobInput = {
  organizationId: string;
  projectId: string;
  ingestionSourceId?: string;
  sourceType: IngestionSourceType;
  sourceUri: string;
  sourceIdentifier?: string;
  status?: IngestionStatus;
};

export type UpdateIngestionJobProgressInput = {
  status?: IngestionStatus;
  discoveredAssetCount?: number;
  importedAssetCount?: number;
  failureReason?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

function validateCreateIngestionSourceInput(input: CreateIngestionSourceInput): void {
  validateIngestionSourceUri(input.sourceType, input.sourceUri);
}

function validateCreateIngestionJobInput(input: CreateIngestionJobInput): void {
  validateIngestionSourceUri(input.sourceType, input.sourceUri);
  validateSourceIdentifier(input.sourceIdentifier);
}

export class IngestionSourceRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  create(input: CreateIngestionSourceInput): Promise<IngestionSource> {
    validateCreateIngestionSourceInput(input);

    return this.client.ingestionSource.create({
      data: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        sourceType: input.sourceType,
        sourceUri: input.sourceUri.trim(),
        sourceLabel: input.sourceLabel,
        isEnabled: input.isEnabled ?? true,
        config: input.config ?? {},
      },
    });
  }

  findById(projectId: string, ingestionSourceId: string): Promise<IngestionSource | null> {
    return this.client.ingestionSource.findFirst({
      where: {
        id: ingestionSourceId,
        projectId: requireProjectId(projectId),
        ...activeRecordsFilter(),
      },
    });
  }

  listByProject(projectId: string, sourceType?: IngestionSourceType): Promise<IngestionSource[]> {
    return this.client.ingestionSource.findMany({
      where: {
        projectId: requireProjectId(projectId),
        ...activeRecordsFilter(),
        ...(sourceType !== undefined ? { sourceType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(
    projectId: string,
    ingestionSourceId: string,
    input: UpdateIngestionSourceInput,
  ): Promise<IngestionSource | null> {
    return this.client.ingestionSource
      .updateMany({
        where: {
          id: ingestionSourceId,
          projectId: requireProjectId(projectId),
          ...activeRecordsFilter(),
        },
        data: {
          sourceLabel: input.sourceLabel,
          isEnabled: input.isEnabled,
          config: input.config,
        },
      })
      .then((result) => (result.count === 0 ? null : this.findById(projectId, ingestionSourceId)));
  }

  softDelete(projectId: string, ingestionSourceId: string): Promise<IngestionSource | null> {
    return this.client.ingestionSource
      .updateMany({
        where: {
          id: ingestionSourceId,
          projectId: requireProjectId(projectId),
          ...activeRecordsFilter(),
        },
        data: { deletedAt: new Date(), isEnabled: false },
      })
      .then((result) => (result.count === 0 ? null : this.findById(projectId, ingestionSourceId)));
  }
}

export class IngestionJobRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  create(input: CreateIngestionJobInput): Promise<IngestionJob> {
    validateCreateIngestionJobInput(input);

    return this.client.ingestionJob.create({
      data: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        ingestionSourceId: input.ingestionSourceId,
        sourceType: input.sourceType,
        sourceUri: input.sourceUri.trim(),
        sourceIdentifier: input.sourceIdentifier?.trim(),
        status: input.status ?? 'pending',
      },
    });
  }

  findById(projectId: string, ingestionJobId: string): Promise<IngestionJob | null> {
    return this.client.ingestionJob.findFirst({
      where: {
        id: ingestionJobId,
        projectId: requireProjectId(projectId),
      },
    });
  }

  listByProject(projectId: string): Promise<IngestionJob[]> {
    return this.client.ingestionJob.findMany({
      where: { projectId: requireProjectId(projectId) },
      orderBy: { createdAt: 'desc' },
    });
  }

  listByStatus(projectId: string, status: IngestionStatus): Promise<IngestionJob[]> {
    return this.client.ingestionJob.findMany({
      where: {
        projectId: requireProjectId(projectId),
        status,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listBySource(projectId: string, ingestionSourceId: string): Promise<IngestionJob[]> {
    return this.client.ingestionJob.findMany({
      where: {
        projectId: requireProjectId(projectId),
        ingestionSourceId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateProgress(
    projectId: string,
    ingestionJobId: string,
    input: UpdateIngestionJobProgressInput,
  ): Promise<IngestionJob | null> {
    const { discoveredAssetCount, importedAssetCount } = input;

    if (discoveredAssetCount !== undefined || importedAssetCount !== undefined) {
      if (discoveredAssetCount !== undefined) {
        validateNonNegativeCount('discoveredAssetCount', discoveredAssetCount);
      }

      if (importedAssetCount !== undefined) {
        validateNonNegativeCount('importedAssetCount', importedAssetCount);
      }

      if (discoveredAssetCount !== undefined && importedAssetCount !== undefined) {
        validateIngestionCounts(discoveredAssetCount, importedAssetCount);
      }
    }

    return this.client.ingestionJob
      .updateMany({
        where: {
          id: ingestionJobId,
          projectId: requireProjectId(projectId),
        },
        data: {
          status: input.status,
          discoveredAssetCount: input.discoveredAssetCount,
          importedAssetCount: input.importedAssetCount,
          failureReason: input.failureReason,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
        },
      })
      .then((result) => (result.count === 0 ? null : this.findById(projectId, ingestionJobId)));
  }
}
