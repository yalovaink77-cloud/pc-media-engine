import type {
  ArtifactType,
  PrismaClient,
  ProcessingArtifact,
  ProcessingJob,
  ProcessingStatus,
  ProcessingType,
} from '@prisma/client';

import { getPrismaClient } from '../client.js';
import {
  validateArtifactChecksum,
  validateArtifactCompatibility,
  validateArtifactMimeType,
  validatePriority,
  validateRetryCount,
  validateStorageKeyPlaceholder,
} from '../domain/processing-validation.js';
import { requireProjectId } from './scoped-query.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export type CreateProcessingJobInput = {
  organizationId: string;
  projectId: string;
  assetId: string;
  processingType: ProcessingType;
  priority?: number;
  status?: ProcessingStatus;
};

export type UpdateProcessingJobInput = {
  status?: ProcessingStatus;
  priority?: number;
  retryCount?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failureReason?: string | null;
};

export type CreateProcessingArtifactInput = {
  organizationId: string;
  projectId: string;
  processingJobId: string;
  assetId: string;
  processingType: ProcessingType;
  artifactType: ArtifactType;
  mimeType: string;
  storageKeyPlaceholder: string;
  checksum?: string;
  sizeBytes?: number;
};

// ---------------------------------------------------------------------------
// ProcessingJobRepository
// ---------------------------------------------------------------------------

export class ProcessingJobRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  create(input: CreateProcessingJobInput): Promise<ProcessingJob> {
    const priority = input.priority ?? 0;
    validatePriority(priority);

    return this.client.processingJob.create({
      data: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        assetId: input.assetId,
        processingType: input.processingType,
        status: input.status ?? 'pending',
        priority,
      },
    });
  }

  findById(projectId: string, jobId: string): Promise<ProcessingJob | null> {
    return this.client.processingJob.findFirst({
      where: {
        id: jobId,
        projectId: requireProjectId(projectId),
      },
    });
  }

  findByAsset(projectId: string, assetId: string): Promise<ProcessingJob[]> {
    return this.client.processingJob.findMany({
      where: {
        projectId: requireProjectId(projectId),
        assetId,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  findByAssetAndType(
    projectId: string,
    assetId: string,
    processingType: ProcessingType,
  ): Promise<ProcessingJob | null> {
    return this.client.processingJob.findFirst({
      where: {
        projectId: requireProjectId(projectId),
        assetId,
        processingType,
      },
    });
  }

  listByProject(projectId: string): Promise<ProcessingJob[]> {
    return this.client.processingJob.findMany({
      where: { projectId: requireProjectId(projectId) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  listByStatus(projectId: string, status: ProcessingStatus): Promise<ProcessingJob[]> {
    return this.client.processingJob.findMany({
      where: {
        projectId: requireProjectId(projectId),
        status,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  update(
    projectId: string,
    jobId: string,
    input: UpdateProcessingJobInput,
  ): Promise<ProcessingJob | null> {
    if (input.priority !== undefined) {
      validatePriority(input.priority);
    }

    if (input.retryCount !== undefined) {
      validateRetryCount(input.retryCount);
    }

    return this.client.processingJob
      .updateMany({
        where: {
          id: jobId,
          projectId: requireProjectId(projectId),
        },
        data: {
          status: input.status,
          priority: input.priority,
          retryCount: input.retryCount,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          failureReason: input.failureReason,
        },
      })
      .then((result) => (result.count === 0 ? null : this.findById(projectId, jobId)));
  }
}

// ---------------------------------------------------------------------------
// ProcessingArtifactRepository
// ---------------------------------------------------------------------------

export class ProcessingArtifactRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  create(input: CreateProcessingArtifactInput): Promise<ProcessingArtifact> {
    validateArtifactCompatibility(input.processingType, input.artifactType);
    validateArtifactMimeType(input.mimeType);
    validateStorageKeyPlaceholder(input.storageKeyPlaceholder);

    if (input.checksum !== undefined) {
      validateArtifactChecksum(input.checksum);
    }

    if (input.sizeBytes !== undefined && input.sizeBytes < 0) {
      throw new Error('sizeBytes must be non-negative');
    }

    return this.client.processingArtifact.create({
      data: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        processingJobId: input.processingJobId,
        assetId: input.assetId,
        artifactType: input.artifactType,
        mimeType: input.mimeType.trim().toLowerCase(),
        storageKeyPlaceholder: input.storageKeyPlaceholder.trim(),
        checksum: input.checksum?.toLowerCase(),
        sizeBytes: input.sizeBytes,
      },
    });
  }

  findById(projectId: string, artifactId: string): Promise<ProcessingArtifact | null> {
    return this.client.processingArtifact.findFirst({
      where: {
        id: artifactId,
        projectId: requireProjectId(projectId),
      },
    });
  }

  listByJob(projectId: string, processingJobId: string): Promise<ProcessingArtifact[]> {
    return this.client.processingArtifact.findMany({
      where: {
        projectId: requireProjectId(projectId),
        processingJobId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  listByAsset(projectId: string, assetId: string): Promise<ProcessingArtifact[]> {
    return this.client.processingArtifact.findMany({
      where: {
        projectId: requireProjectId(projectId),
        assetId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
