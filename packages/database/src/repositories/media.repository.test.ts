import type { Asset, MediaSource, MetadataRecord, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MediaAssetRepository,
  MediaSourceRepository,
  MetadataRecordRepository,
} from '../repositories/media.repository.js';

function createMockPrismaClient(): PrismaClient {
  return {
    asset: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    mediaSource: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    metadataRecord: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaClient;
}

const PROJECT_ID = 'proj_1';
const ORG_ID = 'org_1';
const ASSET_ID = 'clm123abc';
const VALID_SHA256 = 'a'.repeat(64);

const sampleAsset: Asset = {
  id: ASSET_ID,
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  filename: 'cover.jpg',
  originalFilename: 'Cover Photo.jpg',
  mimeType: 'image/jpeg',
  storageProvider: 'local',
  storageKey: 'piercingconnect/clm123abc/cover.jpg',
  sizeBytes: 1024,
  checksum: VALID_SHA256,
  checksumAlgorithm: 'sha256',
  altText: 'Guide cover',
  tags: ['cover'],
  usageRights: null,
  status: 'pending',
  deletedAt: null,
  createdAt: new Date('2026-07-03T12:00:00.000Z'),
  updatedAt: new Date('2026-07-03T12:00:00.000Z'),
};

describe('MediaAssetRepository', () => {
  let client: PrismaClient;
  let repository: MediaAssetRepository;

  beforeEach(() => {
    client = createMockPrismaClient();
    repository = new MediaAssetRepository(client);
  });

  it('creates a media asset record with validated metadata', async () => {
    vi.mocked(client.asset.create).mockResolvedValue(sampleAsset);

    const result = await repository.create({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      filename: 'cover.jpg',
      originalFilename: 'Cover Photo.jpg',
      mimeType: 'image/jpeg',
      storageProvider: 'local',
      storageKey: 'piercingconnect/clm123abc/cover.jpg',
      sizeBytes: 1024,
      checksum: VALID_SHA256,
    });

    expect(result).toEqual(sampleAsset);
    expect(client.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mimeType: 'image/jpeg',
          checksum: VALID_SHA256,
          status: 'pending',
        }),
      }),
    );
  });

  it('rejects invalid MIME types before persistence', () => {
    expect(() =>
      repository.create({
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        filename: 'cover.jpg',
        mimeType: 'invalid',
        storageProvider: 'local',
        storageKey: 'piercingconnect/clm123abc/cover.jpg',
        sizeBytes: 1024,
      }),
    ).toThrowError(/Invalid MIME type/);

    expect(client.asset.create).not.toHaveBeenCalled();
  });

  it('scopes findById to project and active records', async () => {
    vi.mocked(client.asset.findFirst).mockResolvedValue(sampleAsset);

    await repository.findById(PROJECT_ID, ASSET_ID);

    expect(client.asset.findFirst).toHaveBeenCalledWith({
      where: {
        id: ASSET_ID,
        projectId: PROJECT_ID,
        deletedAt: null,
      },
    });
  });

  it('returns null when updateMetadata affects no rows', async () => {
    vi.mocked(client.asset.updateMany).mockResolvedValue({ count: 0 });

    const result = await repository.updateMetadata(PROJECT_ID, ASSET_ID, {
      altText: 'Updated alt text',
    });

    expect(result).toBeNull();
  });
});

describe('MediaSourceRepository', () => {
  let client: PrismaClient;
  let repository: MediaSourceRepository;

  beforeEach(() => {
    client = createMockPrismaClient();
    repository = new MediaSourceRepository(client);
  });

  it('creates a media source record', async () => {
    const source: MediaSource = {
      id: 'source_1',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      sourceType: 'upload',
      sourceUrl: null,
      sourceLabel: 'Operator upload',
      createdAt: new Date('2026-07-03T12:00:00.000Z'),
    };

    vi.mocked(client.mediaSource.create).mockResolvedValue(source);

    const result = await repository.create({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      sourceType: 'upload',
      sourceLabel: 'Operator upload',
    });

    expect(result).toEqual(source);
  });
});

describe('MetadataRecordRepository', () => {
  let client: PrismaClient;
  let repository: MetadataRecordRepository;

  beforeEach(() => {
    client = createMockPrismaClient();
    repository = new MetadataRecordRepository(client);
  });

  it('upserts metadata records under a namespace', async () => {
    const record: MetadataRecord = {
      id: 'meta_1',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      namespace: 'dimensions',
      key: 'width_px',
      value: 1200,
      createdAt: new Date('2026-07-03T12:00:00.000Z'),
      updatedAt: new Date('2026-07-03T12:00:00.000Z'),
    };

    vi.mocked(client.metadataRecord.upsert).mockResolvedValue(record);

    const result = await repository.upsert({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      namespace: 'dimensions',
      key: 'width_px',
      value: 1200,
    });

    expect(result).toEqual(record);
  });

  it('deletes a scoped metadata record when present', async () => {
    const record: MetadataRecord = {
      id: 'meta_1',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      namespace: 'dimensions',
      key: 'width_px',
      value: 1200,
      createdAt: new Date('2026-07-03T12:00:00.000Z'),
      updatedAt: new Date('2026-07-03T12:00:00.000Z'),
    };

    vi.mocked(client.metadataRecord.findFirst).mockResolvedValue(record);
    vi.mocked(client.metadataRecord.delete).mockResolvedValue(record);

    const result = await repository.deleteRecord(PROJECT_ID, ASSET_ID, 'dimensions', 'width_px');

    expect(result).toEqual(record);
    expect(client.metadataRecord.delete).toHaveBeenCalledWith({ where: { id: 'meta_1' } });
  });
});
