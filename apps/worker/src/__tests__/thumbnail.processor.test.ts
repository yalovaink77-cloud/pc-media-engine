import { StorageKeyNotFoundError } from '@pcme/media';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ThumbnailArtifactRepo,
  ThumbnailAssetRepo,
  ThumbnailDeps,
  ThumbnailStorageProvider,
} from '../processors/thumbnail.processor.js';
import {
  AssetNotFoundError,
  buildThumbnailKey,
  THUMBNAIL_MIME,
  THUMBNAIL_WIDTH,
  thumbnailProcessor,
} from '../processors/thumbnail.processor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a minimal real JPEG buffer using Sharp. */
async function makeTestJpeg(width = 200, height = 150): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 149, b: 237 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

const MOCK_JOB = {
  id: 'job-001',
  organizationId: 'org-001',
  projectId: 'proj-001',
  assetId: 'asset-001',
  processingType: 'thumbnail',
};

const MOCK_ASSET = {
  id: 'asset-001',
  organizationId: 'org-001',
  projectId: 'proj-001',
  storageKey: 'piercingconnect/asset-001/photo.jpg',
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeDeps(
  overrides: Partial<{
    assetRepo: Partial<ThumbnailAssetRepo>;
    storageProvider: Partial<ThumbnailStorageProvider>;
    artifactRepo: Partial<ThumbnailArtifactRepo>;
  }> = {},
  jpegBuffer?: Buffer,
): ThumbnailDeps {
  return {
    assetRepo: {
      findByIdGlobal: vi.fn().mockResolvedValue(MOCK_ASSET),
      ...overrides.assetRepo,
    },
    storageProvider: {
      get: vi.fn().mockResolvedValue(jpegBuffer ?? Buffer.from('placeholder')),
      put: vi.fn().mockResolvedValue('piercingconnect/asset-001/photo_thumb.webp'),
      ...overrides.storageProvider,
    },
    artifactRepo: {
      upsertByJobAndType: vi.fn().mockResolvedValue({ id: 'artifact-001' }),
      ...overrides.artifactRepo,
    },
  };
}

// ---------------------------------------------------------------------------
// buildThumbnailKey
// ---------------------------------------------------------------------------

describe('buildThumbnailKey', () => {
  it('appends _thumb.webp to the basename', () => {
    expect(buildThumbnailKey('proj/asset/photo.jpg')).toBe('proj/asset/photo_thumb.webp');
  });

  it('handles png extension', () => {
    expect(buildThumbnailKey('proj/asset/image.png')).toBe('proj/asset/image_thumb.webp');
  });

  it('handles webp extension', () => {
    expect(buildThumbnailKey('proj/asset/image.webp')).toBe('proj/asset/image_thumb.webp');
  });

  it('handles filenames without extension', () => {
    expect(buildThumbnailKey('proj/asset/rawfile')).toBe('proj/asset/rawfile_thumb.webp');
  });
});

// ---------------------------------------------------------------------------
// thumbnailProcessor
// ---------------------------------------------------------------------------

describe('thumbnailProcessor', () => {
  let jpegBuffer: Buffer;

  beforeEach(async () => {
    jpegBuffer = await makeTestJpeg();
    vi.clearAllMocks();
  });

  // — happy path -----------------------------------------------------------

  it('resolves successfully for a valid JPEG', async () => {
    const deps = makeDeps({}, jpegBuffer);
    await expect(thumbnailProcessor(MOCK_JOB, deps)).resolves.toBeUndefined();
  });

  it('calls storageProvider.put with the correct thumbnail key', async () => {
    const deps = makeDeps({}, jpegBuffer);
    await thumbnailProcessor(MOCK_JOB, deps);
    expect(deps.storageProvider.put).toHaveBeenCalledWith(
      'piercingconnect/asset-001/photo_thumb.webp',
      expect.any(Buffer),
      THUMBNAIL_MIME,
    );
  });

  it('output buffer is valid WEBP', async () => {
    let capturedBuffer: Buffer | undefined;
    const deps = makeDeps({
      storageProvider: {
        get: vi.fn().mockResolvedValue(jpegBuffer),
        put: vi.fn().mockImplementation((_key: string, buf: Buffer) => {
          capturedBuffer = buf;
          return Promise.resolve('');
        }),
      },
    });
    await thumbnailProcessor(MOCK_JOB, deps);
    expect(capturedBuffer).toBeDefined();
    const meta = await sharp(capturedBuffer!).metadata();
    expect(meta.format).toBe('webp');
  });

  it('output width does not exceed THUMBNAIL_WIDTH', async () => {
    let capturedBuffer: Buffer | undefined;
    const deps = makeDeps({
      storageProvider: {
        get: vi.fn().mockResolvedValue(jpegBuffer),
        put: vi.fn().mockImplementation((_key: string, buf: Buffer) => {
          capturedBuffer = buf;
          return Promise.resolve('');
        }),
      },
    });
    await thumbnailProcessor(MOCK_JOB, deps);
    const meta = await sharp(capturedBuffer!).metadata();
    expect(meta.width).toBeLessThanOrEqual(THUMBNAIL_WIDTH);
  });

  it('does not enlarge a small image', async () => {
    const smallJpeg = await makeTestJpeg(50, 40);
    let capturedBuffer: Buffer | undefined;
    const deps = makeDeps({
      storageProvider: {
        get: vi.fn().mockResolvedValue(smallJpeg),
        put: vi.fn().mockImplementation((_key: string, buf: Buffer) => {
          capturedBuffer = buf;
          return Promise.resolve('');
        }),
      },
    });
    await thumbnailProcessor(MOCK_JOB, deps);
    const meta = await sharp(capturedBuffer!).metadata();
    // Width should stay at or below the original 50px (no enlargement)
    expect(meta.width).toBeLessThanOrEqual(50);
  });

  it('creates a ProcessingArtifact with mimeType image/webp', async () => {
    const deps = makeDeps({}, jpegBuffer);
    await thumbnailProcessor(MOCK_JOB, deps);
    expect(deps.artifactRepo.upsertByJobAndType).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: THUMBNAIL_MIME }),
    );
  });

  it('creates a ProcessingArtifact with the correct storageKey', async () => {
    const deps = makeDeps({}, jpegBuffer);
    await thumbnailProcessor(MOCK_JOB, deps);
    expect(deps.artifactRepo.upsertByJobAndType).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: 'piercingconnect/asset-001/photo_thumb.webp' }),
    );
  });

  it('creates a ProcessingArtifact linked to the job and asset', async () => {
    const deps = makeDeps({}, jpegBuffer);
    await thumbnailProcessor(MOCK_JOB, deps);
    expect(deps.artifactRepo.upsertByJobAndType).toHaveBeenCalledWith(
      expect.objectContaining({
        processingJobId: 'job-001',
        assetId: 'asset-001',
        artifactType: 'thumbnail',
        processingType: 'thumbnail',
      }),
    );
  });

  // — error cases -----------------------------------------------------------

  it('throws AssetNotFoundError when asset is missing', async () => {
    const deps = makeDeps({ assetRepo: { findByIdGlobal: vi.fn().mockResolvedValue(null) } });
    await expect(thumbnailProcessor(MOCK_JOB, deps)).rejects.toThrow(AssetNotFoundError);
  });

  it('throws StorageKeyNotFoundError when source file is missing', async () => {
    const deps = makeDeps({
      storageProvider: {
        get: vi.fn().mockRejectedValue(new StorageKeyNotFoundError('missing/key')),
        put: vi.fn(),
      },
    });
    await expect(thumbnailProcessor(MOCK_JOB, deps)).rejects.toThrow(StorageKeyNotFoundError);
  });

  it('throws on invalid image bytes (failed Sharp processing)', async () => {
    const garbage = Buffer.from('this is not an image');
    const deps = makeDeps({
      storageProvider: { get: vi.fn().mockResolvedValue(garbage), put: vi.fn() },
    });
    await expect(thumbnailProcessor(MOCK_JOB, deps)).rejects.toThrow();
  });

  it('does not call artifactRepo.upsertByJobAndType when Sharp fails', async () => {
    const garbage = Buffer.from('not-an-image');
    const deps = makeDeps({
      storageProvider: { get: vi.fn().mockResolvedValue(garbage), put: vi.fn() },
    });
    try {
      await thumbnailProcessor(MOCK_JOB, deps);
    } catch {
      // expected
    }
    expect(deps.artifactRepo.upsertByJobAndType).not.toHaveBeenCalled();
  });

  it('creates artifact when none exists (upsert behaves like create)', async () => {
    const newArtifact = {
      id: 'new-artifact',
      storageKey: 'piercingconnect/asset-001/photo_thumb.webp',
    };
    const deps = makeDeps(
      { artifactRepo: { upsertByJobAndType: vi.fn().mockResolvedValue(newArtifact) } },
      jpegBuffer,
    );
    await thumbnailProcessor(MOCK_JOB, deps);
    expect(deps.artifactRepo.upsertByJobAndType).toHaveBeenCalledTimes(1);
    expect(deps.artifactRepo.upsertByJobAndType).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: 'piercingconnect/asset-001/photo_thumb.webp' }),
    );
  });

  it('updates placeholder artifact when one already exists (upsert behaves like update)', async () => {
    const updatedArtifact = {
      id: 'placeholder-artifact',
      storageKey: 'piercingconnect/asset-001/photo_thumb.webp',
      mimeType: 'image/webp',
    };
    const deps = makeDeps(
      { artifactRepo: { upsertByJobAndType: vi.fn().mockResolvedValue(updatedArtifact) } },
      jpegBuffer,
    );
    await thumbnailProcessor(MOCK_JOB, deps);
    // upsert is called exactly once regardless of whether record pre-existed
    expect(deps.artifactRepo.upsertByJobAndType).toHaveBeenCalledTimes(1);
    expect(deps.artifactRepo.upsertByJobAndType).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/webp', artifactType: 'thumbnail' }),
    );
  });
});
