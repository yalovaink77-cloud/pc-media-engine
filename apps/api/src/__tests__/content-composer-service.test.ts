import { describe, expect, it } from 'vitest';

import type { AssetDetail, AssetLibraryService, AssetListItem } from '../assets/types.js';
import { createContentComposerService } from '../composer/content-composer-service.js';
import type { PublisherManagementService } from '../publishers/types.js';

const NOW = '2024-06-01T10:00:00.000Z';

const listItem: AssetListItem = {
  id: 'asset-1',
  projectId: 'proj-1',
  filename: 'hero-photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  status: 'ready',
  dimensions: { width: 800, height: 600 },
  thumbnail: { url: '/assets/asset-1/thumbnail' },
  publisherCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

const detail: AssetDetail = {
  ...listItem,
  originalFilename: 'hero-photo.jpg',
  storageKey: 'proj/hero.jpg',
  storageProvider: 'local',
  tags: ['hero'],
  processingTimeline: [],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  metadata: {},
};

const capabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: true,
  featuredImages: true,
  scheduling: false,
  update: false,
  delete: false,
};

function makeAssetLibrary(overrides: Partial<AssetLibraryService> = {}): AssetLibraryService {
  return {
    listAssets: async () => ({ assets: [listItem], total: 1, limit: 50, offset: 0 }),
    getAsset: async (_p, id) => (id === 'asset-1' ? detail : null),
    getAssetStorageKey: async () => 'proj/hero.jpg',
    getThumbnailStorageKey: async () => 'proj/hero_thumb.webp',
    ...overrides,
  };
}

function makePublisherService(enabled = true): PublisherManagementService {
  return {
    listPublishers: () => [
      {
        id: 'wordpress',
        displayName: 'WordPress',
        version: '1.0.0',
        enabled,
        capabilities,
        supportsHealthCheck: true,
      },
    ],
    getPublisher: (id) =>
      id === 'wordpress'
        ? {
            id: 'wordpress',
            displayName: 'WordPress',
            version: '1.0.0',
            description: 'WordPress REST API',
            enabled,
            capabilities,
            supportsHealthCheck: true,
            configurationRequirements: [
              { envVar: 'WORDPRESS_URL', required: true, description: 'Site URL' },
            ],
          }
        : null,
    checkHealth: async () => ({ healthy: true, latency: 10, message: 'ok' }),
  };
}

describe('createContentComposerService', () => {
  it('lists only ready assets', async () => {
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary(),
      publisherService: makePublisherService(),
    });
    const result = await service.listEligibleAssets({ projectId: 'proj-1' });
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.readiness).toBe('ready');
  });

  it('returns composer detail with SEO and AI metadata', async () => {
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary(),
      publisherService: makePublisherService(),
      env: { AI_METADATA_PROVIDER: 'none' },
    });
    const asset = await service.getComposerAsset('proj-1', 'asset-1');
    expect(asset).not.toBeNull();
    expect(asset?.seo.slug).toBe('hero-photo');
    expect(asset?.seo.seoTitle).toBeTruthy();
    expect(asset?.ai.provider).toBeTruthy();
    expect(asset?.compatiblePublishers).toHaveLength(1);
    expect(asset?.readiness.ready).toBe(true);
  });

  it('marks non-ready assets as not ready', async () => {
    const pending = { ...detail, status: 'processing' };
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary({
        getAsset: async () => pending,
      }),
      publisherService: makePublisherService(),
    });
    const asset = await service.getComposerAsset('proj-1', 'asset-1');
    expect(asset?.readiness.ready).toBe(false);
    expect(asset?.readiness.blockers[0]).toContain('processing');
  });

  it('validates publisher compatibility', async () => {
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary(),
      publisherService: makePublisherService(false),
      env: {},
    });
    const result = await service.validate({
      projectId: 'proj-1',
      assetId: 'asset-1',
      publisherId: 'wordpress',
    });
    expect(result.ready).toBe(false);
    expect(result.missingRequirements.length).toBeGreaterThan(0);
    expect(result.publisherCompatibility.compatible).toBe(false);
  });

  it('warns on duplicate slug', async () => {
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary(),
      publisherService: makePublisherService(),
      findDuplicate: async () => true,
    });
    const result = await service.validate({
      projectId: 'proj-1',
      assetId: 'asset-1',
      publisherId: 'wordpress',
    });
    expect(result.warnings.some((w) => w.includes('already published'))).toBe(true);
  });
});

function makeStorage() {
  return {
    exists: async () => true,
    get: async () => Buffer.from('thumb'),
  };
}

function makeEnqueuer(jobIds: string[] = ['job-1']) {
  let index = 0;
  return {
    enqueue: async () => jobIds[index++] ?? `job-${index}`,
    close: async () => {},
  };
}

describe('createContentComposerService.publish', () => {
  it('enqueues one job per publisher independently', async () => {
    const enqueued: string[] = [];
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary(),
      publisherService: makePublisherService(),
      publishingEnqueuer: {
        enqueue: async () => {
          const id = `job-${enqueued.length + 1}`;
          enqueued.push(id);
          return id;
        },
        close: async () => {},
      },
      storageProvider: makeStorage(),
      defaultOrganizationId: 'org-1',
      env: { WORDPRESS_URL: 'https://wp.test' },
    });
    const result = await service.publish({
      projectId: 'proj-1',
      assetId: 'asset-1',
      publisherIds: ['wordpress', 'wordpress'],
    });
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.publisherId).toBe('wordpress');
    expect(enqueued).toHaveLength(1);
  });

  it('skips duplicate publishers', async () => {
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary(),
      publisherService: makePublisherService(),
      publishingEnqueuer: makeEnqueuer(),
      storageProvider: makeStorage(),
      findDuplicate: async () => true,
      env: { WORDPRESS_URL: 'https://wp.test' },
    });
    const result = await service.publish({
      projectId: 'proj-1',
      assetId: 'asset-1',
      publisherIds: ['wordpress'],
    });
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.publisherId).toBe('wordpress');
    expect(result.accepted).toHaveLength(0);
  });

  it('records validation failures without blocking other publishers', async () => {
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary(),
      publisherService: makePublisherService(false),
      publishingEnqueuer: makeEnqueuer(),
      storageProvider: makeStorage(),
      env: {},
    });
    const result = await service.publish({
      projectId: 'proj-1',
      assetId: 'asset-1',
      publisherIds: ['wordpress', 'unknown'],
    });
    expect(result.failures.length).toBeGreaterThanOrEqual(1);
    expect(result.accepted).toHaveLength(0);
  });

  it('fails when thumbnail media unavailable', async () => {
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary({
        getThumbnailStorageKey: async () => null,
      }),
      publisherService: makePublisherService(),
      publishingEnqueuer: makeEnqueuer(),
      env: { WORDPRESS_URL: 'https://wp.test' },
    });
    const result = await service.publish({
      projectId: 'proj-1',
      assetId: 'asset-1',
      publisherIds: ['wordpress'],
    });
    expect(result.failures[0]?.reason).toContain('Thumbnail');
  });

  it('fails when queue unavailable', async () => {
    const service = createContentComposerService({
      assetLibrary: makeAssetLibrary(),
      publisherService: makePublisherService(),
      storageProvider: makeStorage(),
      env: { WORDPRESS_URL: 'https://wp.test' },
    });
    const result = await service.publish({
      projectId: 'proj-1',
      assetId: 'asset-1',
      publisherIds: ['wordpress'],
    });
    expect(result.failures[0]?.publisherId).toBe('*');
    expect(result.failures[0]?.reason).toContain('queue');
  });
});
