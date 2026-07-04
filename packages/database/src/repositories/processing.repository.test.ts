import type { PrismaClient, ProcessingArtifact, ProcessingJob } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessingValidationError } from '../domain/processing-validation.js';
import { ProcessingArtifactRepository, ProcessingJobRepository } from './processing.repository.js';

function makeMockClient(): PrismaClient {
  return {
    processingJob: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    processingArtifact: {
      create: vi.fn(),
      upsert: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  } as unknown as PrismaClient;
}

const PROJECT_ID = 'proj_1';
const ORG_ID = 'org_1';
const ASSET_ID = 'clmasset001';
const JOB_ID = 'clmjob001';
const ARTIFACT_ID = 'clmartifact001';
const VALID_SHA256 = 'b'.repeat(64);

const sampleJob: ProcessingJob = {
  id: JOB_ID,
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  assetId: ASSET_ID,
  processingType: 'thumbnail',
  status: 'pending',
  priority: 0,
  retryCount: 0,
  requestedAt: new Date('2026-07-04T13:00:00.000Z'),
  startedAt: null,
  completedAt: null,
  failureReason: null,
  createdAt: new Date('2026-07-04T13:00:00.000Z'),
  updatedAt: new Date('2026-07-04T13:00:00.000Z'),
};

const sampleArtifact: ProcessingArtifact = {
  id: ARTIFACT_ID,
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  processingJobId: JOB_ID,
  assetId: ASSET_ID,
  artifactType: 'thumbnail',
  mimeType: 'image/jpeg',
  storageKeyPlaceholder: 'piercingconnect/clmasset001/thumb-cover.jpg',
  checksum: VALID_SHA256,
  sizeBytes: 8192,
  createdAt: new Date('2026-07-04T13:00:00.000Z'),
  updatedAt: new Date('2026-07-04T13:00:00.000Z'),
};

// ---------------------------------------------------------------------------
// ProcessingJobRepository
// ---------------------------------------------------------------------------

describe('ProcessingJobRepository', () => {
  let client: PrismaClient;
  let repo: ProcessingJobRepository;

  beforeEach(() => {
    client = makeMockClient();
    repo = new ProcessingJobRepository(client);
  });

  it('creates a processing job with default priority and status', async () => {
    vi.mocked(client.processingJob.create).mockResolvedValue(sampleJob);

    const result = await repo.create({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      processingType: 'thumbnail',
    });

    expect(result).toEqual(sampleJob);
    expect(client.processingJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          priority: 0,
          processingType: 'thumbnail',
        }),
      }),
    );
  });

  it('rejects out-of-range priority before persistence', () => {
    expect(() =>
      repo.create({
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        assetId: ASSET_ID,
        processingType: 'thumbnail',
        priority: 200,
      }),
    ).toThrow(ProcessingValidationError);

    expect(client.processingJob.create).not.toHaveBeenCalled();
  });

  it('scopes findById to the project', async () => {
    vi.mocked(client.processingJob.findFirst).mockResolvedValue(sampleJob);

    await repo.findById(PROJECT_ID, JOB_ID);

    expect(client.processingJob.findFirst).toHaveBeenCalledWith({
      where: { id: JOB_ID, projectId: PROJECT_ID },
    });
  });

  it('returns null when update affects no rows', async () => {
    vi.mocked(client.processingJob.updateMany).mockResolvedValue({ count: 0 });

    const result = await repo.update(PROJECT_ID, JOB_ID, { status: 'running' });

    expect(result).toBeNull();
  });

  it('validates retryCount on update', () => {
    expect(() => repo.update(PROJECT_ID, JOB_ID, { retryCount: -1 })).toThrow(
      ProcessingValidationError,
    );

    expect(client.processingJob.updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ProcessingArtifactRepository
// ---------------------------------------------------------------------------

describe('ProcessingArtifactRepository', () => {
  let client: PrismaClient;
  let repo: ProcessingArtifactRepository;

  beforeEach(() => {
    client = makeMockClient();
    repo = new ProcessingArtifactRepository(client);
  });

  it('creates an artifact with validated metadata', async () => {
    vi.mocked(client.processingArtifact.create).mockResolvedValue(sampleArtifact);

    const result = await repo.create({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      processingJobId: JOB_ID,
      assetId: ASSET_ID,
      processingType: 'thumbnail',
      artifactType: 'thumbnail',
      mimeType: 'image/jpeg',
      storageKeyPlaceholder: 'piercingconnect/clmasset001/thumb-cover.jpg',
      checksum: VALID_SHA256,
      sizeBytes: 8192,
    });

    expect(result).toEqual(sampleArtifact);
  });

  it('rejects incompatible processingType/artifactType pairs', () => {
    expect(() =>
      repo.create({
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        processingJobId: JOB_ID,
        assetId: ASSET_ID,
        processingType: 'thumbnail',
        artifactType: 'transcript',
        mimeType: 'text/plain',
        storageKeyPlaceholder: 'piercingconnect/clmasset001/transcript.txt',
      }),
    ).toThrow(ProcessingValidationError);

    expect(client.processingArtifact.create).not.toHaveBeenCalled();
  });

  it('rejects invalid MIME types', () => {
    expect(() =>
      repo.create({
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        processingJobId: JOB_ID,
        assetId: ASSET_ID,
        processingType: 'thumbnail',
        artifactType: 'thumbnail',
        mimeType: 'not-valid',
        storageKeyPlaceholder: 'piercingconnect/clmasset001/thumb.jpg',
      }),
    ).toThrow(ProcessingValidationError);
  });

  it('rejects malformed storage key placeholders', () => {
    expect(() =>
      repo.create({
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        processingJobId: JOB_ID,
        assetId: ASSET_ID,
        processingType: 'thumbnail',
        artifactType: 'thumbnail',
        mimeType: 'image/jpeg',
        storageKeyPlaceholder: '/absolute/not/allowed.jpg',
      }),
    ).toThrow(ProcessingValidationError);
  });

  it('upsertByJobAndType uses the compound unique index to avoid duplicates', async () => {
    vi.mocked(client.processingArtifact.upsert).mockResolvedValue({
      ...sampleArtifact,
      storageKey: 'piercingconnect/clmasset001/thumb-cover_thumb.webp',
      mimeType: 'image/webp',
    });

    const result = await repo.upsertByJobAndType({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      processingJobId: JOB_ID,
      assetId: ASSET_ID,
      processingType: 'thumbnail',
      artifactType: 'thumbnail',
      mimeType: 'image/webp',
      storageKeyPlaceholder: `${PROJECT_ID}/${ASSET_ID}/thumbnail-pending`,
      storageKey: 'piercingconnect/clmasset001/thumb-cover_thumb.webp',
      sizeBytes: 4096,
    });

    expect(result.mimeType).toBe('image/webp');
    expect(client.processingArtifact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          processingJobId_artifactType: {
            processingJobId: JOB_ID,
            artifactType: 'thumbnail',
          },
        },
      }),
    );
  });

  it('upsertByJobAndType rejects invalid MIME types', () => {
    expect(() =>
      repo.upsertByJobAndType({
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        processingJobId: JOB_ID,
        assetId: ASSET_ID,
        processingType: 'thumbnail',
        artifactType: 'thumbnail',
        mimeType: 'not-valid',
        storageKeyPlaceholder: `${PROJECT_ID}/${ASSET_ID}/thumbnail-pending`,
      }),
    ).toThrow(ProcessingValidationError);
    expect(client.processingArtifact.upsert).not.toHaveBeenCalled();
  });
});
