import type { IngestionJob, IngestionSource, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IngestionJobRepository, IngestionSourceRepository } from './ingestion.repository.js';

function createMockPrismaClient(): PrismaClient {
  return {
    ingestionSource: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    ingestionJob: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  } as unknown as PrismaClient;
}

const PROJECT_ID = 'proj_1';
const ORG_ID = 'org_1';
const SOURCE_ID = 'src_1';
const JOB_ID = 'job_1';

const sampleSource: IngestionSource = {
  id: SOURCE_ID,
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  sourceType: 'local_folder',
  sourceUri: './data/media/piercingconnect/inbox',
  sourceLabel: 'Local inbox',
  isEnabled: true,
  config: {},
  deletedAt: null,
  createdAt: new Date('2026-07-04T12:00:00.000Z'),
  updatedAt: new Date('2026-07-04T12:00:00.000Z'),
};

const sampleJob: IngestionJob = {
  id: JOB_ID,
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  ingestionSourceId: SOURCE_ID,
  status: 'pending',
  sourceType: 'local_folder',
  sourceUri: './data/media/piercingconnect/inbox',
  sourceIdentifier: null,
  discoveredAssetCount: 0,
  importedAssetCount: 0,
  failureReason: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date('2026-07-04T12:00:00.000Z'),
  updatedAt: new Date('2026-07-04T12:00:00.000Z'),
};

describe('IngestionSourceRepository', () => {
  let client: PrismaClient;
  let repository: IngestionSourceRepository;

  beforeEach(() => {
    client = createMockPrismaClient();
    repository = new IngestionSourceRepository(client);
  });

  it('creates an ingestion source record', async () => {
    vi.mocked(client.ingestionSource.create).mockResolvedValue(sampleSource);

    const result = await repository.create({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      sourceType: 'local_folder',
      sourceUri: './data/media/piercingconnect/inbox',
      sourceLabel: 'Local inbox',
    });

    expect(result).toEqual(sampleSource);
  });

  it('rejects invalid source URIs before persistence', () => {
    expect(() =>
      repository.create({
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        sourceType: 'youtube',
        sourceUri: 'not-a-url',
      }),
    ).toThrowError(/Invalid URL/);

    expect(client.ingestionSource.create).not.toHaveBeenCalled();
  });

  it('scopes findById to project and active records', async () => {
    vi.mocked(client.ingestionSource.findFirst).mockResolvedValue(sampleSource);

    await repository.findById(PROJECT_ID, SOURCE_ID);

    expect(client.ingestionSource.findFirst).toHaveBeenCalledWith({
      where: {
        id: SOURCE_ID,
        projectId: PROJECT_ID,
        deletedAt: null,
      },
    });
  });
});

describe('IngestionJobRepository', () => {
  let client: PrismaClient;
  let repository: IngestionJobRepository;

  beforeEach(() => {
    client = createMockPrismaClient();
    repository = new IngestionJobRepository(client);
  });

  it('creates an ingestion job record', async () => {
    vi.mocked(client.ingestionJob.create).mockResolvedValue(sampleJob);

    const result = await repository.create({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      ingestionSourceId: SOURCE_ID,
      sourceType: 'local_folder',
      sourceUri: './data/media/piercingconnect/inbox',
    });

    expect(result).toEqual(sampleJob);
    expect(client.ingestionJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
        }),
      }),
    );
  });

  it('updates job progress with validated counts', async () => {
    vi.mocked(client.ingestionJob.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(client.ingestionJob.findFirst).mockResolvedValue({
      ...sampleJob,
      status: 'completed',
      discoveredAssetCount: 5,
      importedAssetCount: 5,
    });

    const result = await repository.updateProgress(PROJECT_ID, JOB_ID, {
      status: 'completed',
      discoveredAssetCount: 5,
      importedAssetCount: 5,
      completedAt: new Date('2026-07-04T12:05:00.000Z'),
    });

    expect(result?.status).toBe('completed');
    expect(result?.importedAssetCount).toBe(5);
  });

  it('rejects invalid count updates before persistence', () => {
    expect(() =>
      repository.updateProgress(PROJECT_ID, JOB_ID, {
        discoveredAssetCount: 2,
        importedAssetCount: 5,
      }),
    ).toThrowError(/cannot exceed discoveredAssetCount/);

    expect(client.ingestionJob.updateMany).not.toHaveBeenCalled();
  });
});
