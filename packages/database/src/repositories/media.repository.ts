import type {
  Asset,
  AssetStatus,
  MediaSource,
  MediaSourceType,
  MetadataRecord,
  Prisma,
  PrismaClient,
} from '@prisma/client';

import { getPrismaClient } from '../client.js';
import {
  validateChecksum,
  validateChecksumAlgorithm,
  validateMetadataKey,
  validateMetadataNamespace,
  validateMimeType,
  validateStorageKey,
} from '../domain/media-validation.js';
import { activeRecordsFilter, requireProjectId } from './scoped-query.js';

export type CreateMediaAssetInput = {
  organizationId: string;
  projectId: string;
  filename: string;
  originalFilename?: string;
  mimeType: string;
  storageProvider: string;
  storageKey: string;
  sizeBytes: number;
  checksum?: string;
  checksumAlgorithm?: string;
  altText?: string;
  tags?: string[];
  usageRights?: string;
  status?: AssetStatus;
};

export type UpdateMediaAssetMetadataInput = {
  filename?: string;
  originalFilename?: string;
  mimeType?: string;
  altText?: string | null;
  tags?: string[];
  usageRights?: string | null;
  checksum?: string | null;
  checksumAlgorithm?: string;
  status?: AssetStatus;
};

export type CreateMediaSourceInput = {
  organizationId: string;
  projectId: string;
  assetId: string;
  sourceType: MediaSourceType;
  sourceUrl?: string;
  sourceLabel?: string;
};

export type UpsertMetadataRecordInput = {
  organizationId: string;
  projectId: string;
  assetId: string;
  namespace: string;
  key: string;
  value: Prisma.InputJsonValue;
};

function validateCreateMediaAssetInput(input: CreateMediaAssetInput): void {
  validateMimeType(input.mimeType);
  validateStorageKey(input.storageKey);

  const algorithm = input.checksumAlgorithm ?? 'sha256';
  validateChecksumAlgorithm(algorithm);

  if (input.checksum !== undefined) {
    validateChecksum(input.checksum, algorithm);
  }

  if (input.sizeBytes < 0) {
    throw new Error('sizeBytes must be non-negative');
  }
}

export class MediaAssetRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  create(input: CreateMediaAssetInput): Promise<Asset> {
    validateCreateMediaAssetInput(input);

    const originalFilename = input.originalFilename ?? input.filename;
    const checksumAlgorithm = input.checksumAlgorithm ?? 'sha256';

    return this.client.asset.create({
      data: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        filename: input.filename,
        originalFilename,
        mimeType: input.mimeType.trim().toLowerCase(),
        storageProvider: input.storageProvider,
        storageKey: input.storageKey.trim(),
        sizeBytes: input.sizeBytes,
        checksum: input.checksum?.toLowerCase(),
        checksumAlgorithm,
        altText: input.altText,
        tags: input.tags ?? [],
        usageRights: input.usageRights,
        status: input.status ?? 'pending',
      },
    });
  }

  findById(projectId: string, assetId: string): Promise<Asset | null> {
    return this.client.asset.findFirst({
      where: {
        id: assetId,
        projectId: requireProjectId(projectId),
        ...activeRecordsFilter(),
      },
    });
  }

  findByStorageKey(projectId: string, storageKey: string): Promise<Asset | null> {
    validateStorageKey(storageKey);

    return this.client.asset.findFirst({
      where: {
        projectId: requireProjectId(projectId),
        storageKey: storageKey.trim(),
        ...activeRecordsFilter(),
      },
    });
  }

  findByChecksum(projectId: string, checksum: string, algorithm = 'sha256'): Promise<Asset | null> {
    validateChecksum(checksum, algorithm);

    return this.client.asset.findFirst({
      where: {
        projectId: requireProjectId(projectId),
        checksum: checksum.toLowerCase(),
        checksumAlgorithm: algorithm,
        ...activeRecordsFilter(),
      },
    });
  }

  listByProject(projectId: string): Promise<Asset[]> {
    return this.client.asset.findMany({
      where: {
        projectId: requireProjectId(projectId),
        ...activeRecordsFilter(),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listByStatus(projectId: string, status: AssetStatus): Promise<Asset[]> {
    return this.client.asset.findMany({
      where: {
        projectId: requireProjectId(projectId),
        status,
        ...activeRecordsFilter(),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateMetadata(
    projectId: string,
    assetId: string,
    input: UpdateMediaAssetMetadataInput,
  ): Promise<Asset | null> {
    if (input.mimeType !== undefined) {
      validateMimeType(input.mimeType);
    }

    const algorithm =
      input.checksumAlgorithm ?? (input.checksum !== undefined ? 'sha256' : undefined);
    if (algorithm !== undefined) {
      validateChecksumAlgorithm(algorithm);
    }

    if (input.checksum !== undefined && input.checksum !== null) {
      validateChecksum(input.checksum, algorithm ?? 'sha256');
    }

    return this.client.asset
      .updateMany({
        where: {
          id: assetId,
          projectId: requireProjectId(projectId),
          ...activeRecordsFilter(),
        },
        data: {
          filename: input.filename,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType?.trim().toLowerCase(),
          altText: input.altText,
          tags: input.tags,
          usageRights: input.usageRights,
          checksum: input.checksum === null ? null : input.checksum?.toLowerCase(),
          checksumAlgorithm: input.checksumAlgorithm,
          status: input.status,
        },
      })
      .then((result) => (result.count === 0 ? null : this.findById(projectId, assetId)));
  }

  softDelete(projectId: string, assetId: string): Promise<Asset | null> {
    return this.client.asset
      .updateMany({
        where: {
          id: assetId,
          projectId: requireProjectId(projectId),
          ...activeRecordsFilter(),
        },
        data: { deletedAt: new Date() },
      })
      .then((result) => (result.count === 0 ? null : this.findById(projectId, assetId)));
  }
}

export class MediaSourceRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  create(input: CreateMediaSourceInput): Promise<MediaSource> {
    return this.client.mediaSource.create({
      data: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        assetId: input.assetId,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        sourceLabel: input.sourceLabel,
      },
    });
  }

  findByAssetId(projectId: string, assetId: string): Promise<MediaSource[]> {
    return this.client.mediaSource.findMany({
      where: {
        projectId: requireProjectId(projectId),
        assetId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  listByProject(projectId: string, sourceType?: MediaSourceType): Promise<MediaSource[]> {
    return this.client.mediaSource.findMany({
      where: {
        projectId: requireProjectId(projectId),
        ...(sourceType !== undefined ? { sourceType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export class MetadataRecordRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  upsert(input: UpsertMetadataRecordInput): Promise<MetadataRecord> {
    validateMetadataNamespace(input.namespace);
    validateMetadataKey(input.key);

    return this.client.metadataRecord.upsert({
      where: {
        assetId_namespace_key: {
          assetId: input.assetId,
          namespace: input.namespace,
          key: input.key,
        },
      },
      create: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        assetId: input.assetId,
        namespace: input.namespace,
        key: input.key,
        value: input.value,
      },
      update: {
        value: input.value,
      },
    });
  }

  findByAsset(projectId: string, assetId: string): Promise<MetadataRecord[]> {
    return this.client.metadataRecord.findMany({
      where: {
        projectId: requireProjectId(projectId),
        assetId,
      },
      orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
    });
  }

  findByAssetNamespace(
    projectId: string,
    assetId: string,
    namespace: string,
  ): Promise<MetadataRecord[]> {
    validateMetadataNamespace(namespace);

    return this.client.metadataRecord.findMany({
      where: {
        projectId: requireProjectId(projectId),
        assetId,
        namespace,
      },
      orderBy: { key: 'asc' },
    });
  }

  async deleteRecord(
    projectId: string,
    assetId: string,
    namespace: string,
    key: string,
  ): Promise<MetadataRecord | null> {
    validateMetadataNamespace(namespace);
    validateMetadataKey(key);

    const existing = await this.client.metadataRecord.findFirst({
      where: {
        projectId: requireProjectId(projectId),
        assetId,
        namespace,
        key,
      },
    });

    if (existing === null) {
      return null;
    }

    return this.client.metadataRecord.delete({
      where: { id: existing.id },
    });
  }
}

/** @deprecated Use MediaAssetRepository — kept for Sprint 2 call sites during transition. */
export class AssetRepository extends MediaAssetRepository {}
