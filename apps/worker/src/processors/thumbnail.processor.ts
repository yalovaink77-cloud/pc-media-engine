import { extname } from 'node:path';

import type { MediaAssetRepository, ProcessingArtifactRepository } from '@pcme/database';
import type { StorageProvider } from '@pcme/media';
import { StorageKeyNotFoundError } from '@pcme/media';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Thumbnail constants
// ---------------------------------------------------------------------------

export const THUMBNAIL_WIDTH = 512;
export const THUMBNAIL_QUALITY = 80;
export const THUMBNAIL_MIME = 'image/webp' as const;
export const THUMBNAIL_EXT = '_thumb.webp';

// ---------------------------------------------------------------------------
// Dependency injection types
// ---------------------------------------------------------------------------

export type ThumbnailAssetRepo = Pick<MediaAssetRepository, 'findByIdGlobal'>;
export type ThumbnailArtifactRepo = Pick<ProcessingArtifactRepository, 'upsertByJobAndType'>;
export type ThumbnailStorageProvider = Pick<StorageProvider, 'get' | 'put'>;

export type ThumbnailDeps = {
  assetRepo: ThumbnailAssetRepo;
  storageProvider: ThumbnailStorageProvider;
  artifactRepo: ThumbnailArtifactRepo;
};

// ---------------------------------------------------------------------------
// Minimal job shape the processor needs (avoids importing full Prisma type)
// ---------------------------------------------------------------------------

export type ThumbnailJob = {
  id: string;
  organizationId: string;
  projectId: string;
  assetId: string;
  processingType: string;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Asset not found: ${assetId}`);
    this.name = 'AssetNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Storage key utilities
// ---------------------------------------------------------------------------

/**
 * Derive the thumbnail storage key from the original asset storage key.
 *
 * Original: `{projectSlug}/{assetId}/photo.jpg`
 * Thumbnail: `{projectSlug}/{assetId}/photo_thumb.webp`
 */
export function buildThumbnailKey(originalKey: string): string {
  const lastSlash = originalKey.lastIndexOf('/');
  const dir = originalKey.slice(0, lastSlash);
  const filename = originalKey.slice(lastSlash + 1);
  const ext = extname(filename);
  const basename = ext ? filename.slice(0, -ext.length) : filename;
  return `${dir}/${basename}${THUMBNAIL_EXT}`;
}

// ---------------------------------------------------------------------------
// Thumbnail processor
// ---------------------------------------------------------------------------

/**
 * Generate a webp thumbnail for an image asset.
 *
 * Steps:
 *   1. Load the Asset record from the database.
 *   2. Read the original file from storage.
 *   3. Run Sharp: resize to max 512 px wide (keep aspect ratio, no enlargement), encode as webp quality 80.
 *   4. Write the thumbnail to storage.
 *   5. Create a ProcessingArtifact record.
 *
 * Throws `AssetNotFoundError`      if the asset does not exist in the database.
 * Throws `StorageKeyNotFoundError` if the source file is missing from storage.
 * Re-throws Sharp errors verbatim  if the image cannot be decoded.
 */
export async function thumbnailProcessor(job: ThumbnailJob, deps: ThumbnailDeps): Promise<void> {
  // 1. Load asset
  const asset = await deps.assetRepo.findByIdGlobal(job.assetId);
  if (!asset) {
    throw new AssetNotFoundError(job.assetId);
  }

  // 2. Read source file from storage
  let sourceBuffer: Buffer;
  try {
    sourceBuffer = await deps.storageProvider.get(asset.storageKey);
  } catch (err) {
    if (err instanceof StorageKeyNotFoundError) throw err;
    throw new Error(`Failed to read source file: ${(err as Error).message}`);
  }

  // 3. Generate thumbnail with Sharp
  const thumbBuffer = await sharp(sourceBuffer)
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  // 4. Save thumbnail to storage
  const thumbKey = buildThumbnailKey(asset.storageKey);
  await deps.storageProvider.put(thumbKey, thumbBuffer, THUMBNAIL_MIME);

  // 5. Create or update ProcessingArtifact (upsert avoids duplicate on retry/seed)
  const storageKeyPlaceholder = `${job.projectId}/${job.assetId}/thumbnail-pending`;

  await deps.artifactRepo.upsertByJobAndType({
    organizationId: job.organizationId,
    projectId: job.projectId,
    processingJobId: job.id,
    assetId: job.assetId,
    processingType: 'thumbnail',
    artifactType: 'thumbnail',
    mimeType: THUMBNAIL_MIME,
    storageKeyPlaceholder,
    storageKey: thumbKey,
    sizeBytes: thumbBuffer.length,
  });
}
