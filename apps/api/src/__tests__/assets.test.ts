import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { AssetDetail, AssetLibraryService, AssetListItem } from '../assets/types.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.39.0-test',
  databaseUrl: 'postgres://test',
  storageLocalRoot: '/tmp/storage',
  defaultOrgId: 'org-1',
  defaultProjectId: 'proj-abc',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const assetFixture: AssetListItem = {
  id: 'asset-001',
  projectId: 'proj-abc',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 204800,
  status: 'ready',
  dimensions: { width: 1920, height: 1080 },
  thumbnail: { url: '/assets/asset-001/thumbnail', mimeType: 'image/webp' },
  publisherCount: 1,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:05:00.000Z',
};

const detailFixture: AssetDetail = {
  ...assetFixture,
  originalFilename: 'photo.jpg',
  storageKey: 'piercingconnect/asset-001/photo.jpg',
  storageProvider: 'local',
  tags: ['hero'],
  processingTimeline: [
    {
      id: 'proc-1',
      processingType: 'thumbnail',
      status: 'completed',
      retryCount: 0,
      createdAt: '2024-06-01T10:01:00.000Z',
      completedAt: '2024-06-01T10:02:00.000Z',
    },
  ],
  publishingHistory: [
    {
      id: 'pub-1',
      publisher: 'mock',
      status: 'published',
      url: 'https://example.com/post',
      slug: 'photo',
      publishedAt: '2024-06-01T11:00:00.000Z',
    },
  ],
  publishingSummary: { total: 1, publishers: [{ publisher: 'mock', count: 1 }] },
  downloadUrl: '/assets/asset-001/download',
  metadata: { dimensions: { width_px: 1920, height_px: 1080 } },
};

function makeMockLibrary(overrides: Partial<AssetLibraryService> = {}): AssetLibraryService {
  return {
    listAssets: vi.fn().mockResolvedValue({
      assets: [assetFixture],
      total: 1,
      limit: 50,
      offset: 0,
    }),
    getAsset: vi.fn().mockResolvedValue(detailFixture),
    getAssetStorageKey: vi.fn().mockResolvedValue('piercingconnect/asset-001/photo.jpg'),
    getThumbnailStorageKey: vi.fn().mockResolvedValue('piercingconnect/asset-001/photo_thumb.webp'),
    ...overrides,
  };
}

let app: ReturnType<typeof buildApp> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /assets', () => {
  it('returns paginated assets', async () => {
    const library = makeMockLibrary();
    app = buildApp({ config: baseConfig, assetLibrary: library });
    const res = await app.inject({ method: 'GET', url: '/assets' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { assets: AssetListItem[]; total: number };
    expect(body.total).toBe(1);
    expect(body.assets[0]?.id).toBe('asset-001');
    expect(body.assets[0]?.publisherCount).toBe(1);
    expect(library.listAssets).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-abc', limit: 50, offset: 0 }),
    );
  });

  it('passes filters to listAssets', async () => {
    const library = makeMockLibrary();
    app = buildApp({ config: baseConfig, assetLibrary: library });
    await app.inject({
      method: 'GET',
      url: '/assets?status=ready&mimeType=image/jpeg&limit=10&offset=5',
    });
    expect(library.listAssets).toHaveBeenCalledWith({
      projectId: 'proj-abc',
      status: 'ready',
      mimeType: 'image/jpeg',
      limit: 10,
      offset: 5,
    });
  });

  it('returns 400 for invalid status', async () => {
    app = buildApp({ config: baseConfig, assetLibrary: makeMockLibrary() });
    const res = await app.inject({ method: 'GET', url: '/assets?status=invalid' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 503 when library absent', async () => {
    app = buildApp({ config: baseConfig });
    const res = await app.inject({ method: 'GET', url: '/assets' });
    expect(res.statusCode).toBe(503);
  });
});

describe('GET /assets/:id', () => {
  it('returns asset detail with processing timeline', async () => {
    app = buildApp({ config: baseConfig, assetLibrary: makeMockLibrary() });
    const res = await app.inject({ method: 'GET', url: '/assets/asset-001' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as AssetDetail;
    expect(body.processingTimeline).toHaveLength(1);
    expect(body.publishingHistory).toHaveLength(1);
    expect(body.downloadUrl).toContain('/download');
  });

  it('returns 404 for missing asset', async () => {
    app = buildApp({
      config: baseConfig,
      assetLibrary: makeMockLibrary({ getAsset: vi.fn().mockResolvedValue(null) }),
    });
    const res = await app.inject({ method: 'GET', url: '/assets/missing' });
    expect(res.statusCode).toBe(404);
  });
});

describe('asset pagination', () => {
  it('respects limit and offset in response', async () => {
    app = buildApp({
      config: baseConfig,
      assetLibrary: makeMockLibrary({
        listAssets: vi.fn().mockResolvedValue({
          assets: [],
          total: 25,
          limit: 10,
          offset: 20,
        }),
      }),
    });
    const res = await app.inject({ method: 'GET', url: '/assets?limit=10&offset=20' });
    const body = res.json() as { total: number; limit: number; offset: number };
    expect(body.total).toBe(25);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(20);
  });
});
