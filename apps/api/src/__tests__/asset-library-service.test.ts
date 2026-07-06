import type { Asset } from '@pcme/database';
import { describe, expect, it } from 'vitest';

import {
  type AssetLibraryDeps,
  createAssetLibraryService,
} from '../assets/asset-library-service.js';

const NOW = new Date('2024-06-01T10:00:00.000Z');

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    ingestionJobId: null,
    filename: 'test.jpg',
    originalFilename: 'test.jpg',
    mimeType: 'image/jpeg',
    storageProvider: 'local',
    storageKey: 'proj/test.jpg',
    sizeBytes: 1024,
    checksum: null,
    checksumAlgorithm: 'sha256',
    altText: null,
    tags: [],
    usageRights: null,
    status: 'ready',
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Asset;
}

function makeDeps(overrides: Partial<AssetLibraryDeps> = {}): AssetLibraryDeps {
  return {
    listAssets: async () => [
      makeAsset(),
      makeAsset({ id: 'asset-2', mimeType: 'image/png', status: 'pending' }),
    ],
    findAsset: async (_p, id) => (id === 'asset-1' ? makeAsset() : null),
    findProcessingJobs: async () => [],
    listArtifacts: async () => [],
    findDimensions: async () => [
      { namespace: 'dimensions', key: 'width_px', value: 800 } as never,
      { namespace: 'dimensions', key: 'height_px', value: 600 } as never,
    ],
    findAllMetadata: async () => [],
    findPublished: async () => [],
    ...overrides,
  };
}

describe('createAssetLibraryService', () => {
  it('lists and paginates assets', async () => {
    const service = createAssetLibraryService(makeDeps());
    const result = await service.listAssets({ projectId: 'proj-1', limit: 1, offset: 0 });
    expect(result.total).toBe(2);
    expect(result.assets).toHaveLength(1);
  });

  it('filters by mimeType and status', async () => {
    const service = createAssetLibraryService(makeDeps());
    const result = await service.listAssets({
      projectId: 'proj-1',
      mimeType: 'image/png',
      status: 'pending',
    });
    expect(result.total).toBe(1);
    expect(result.assets[0]?.id).toBe('asset-2');
  });

  it('returns null for unknown asset', async () => {
    const service = createAssetLibraryService(makeDeps());
    expect(await service.getAsset('proj-1', 'missing')).toBeNull();
  });

  it('includes dimensions in detail', async () => {
    const service = createAssetLibraryService(makeDeps());
    const detail = await service.getAsset('proj-1', 'asset-1');
    expect(detail?.dimensions?.width).toBe(800);
    expect(detail?.dimensions?.height).toBe(600);
  });
});
