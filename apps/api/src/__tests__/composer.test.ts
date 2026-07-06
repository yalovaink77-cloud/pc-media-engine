import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type {
  ComposerAssetDetail,
  ComposerAssetListItem,
  ContentComposerService,
} from '../composer/types.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.40.0-test',
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

const listItem: ComposerAssetListItem = {
  id: 'asset-001',
  projectId: 'proj-abc',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  status: 'ready',
  readiness: 'ready',
  thumbnail: { url: '/assets/asset-001/thumbnail' },
  publisherCount: 0,
  createdAt: '2024-06-01T10:00:00.000Z',
};

const detailFixture: ComposerAssetDetail = {
  id: 'asset-001',
  projectId: 'proj-abc',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 204800,
  status: 'ready',
  dimensions: { width: 1920, height: 1080 },
  thumbnail: { url: '/assets/asset-001/thumbnail' },
  tags: [],
  seo: {
    slug: 'photo',
    seoTitle: 'Photo',
    excerpt: 'Publish-ready content for photo.',
    metaDescription: 'Publish-ready content for photo.',
    readingTimeMinutes: 1,
    tags: [],
    categories: [],
  },
  ai: { provider: 'none', aiApplied: false },
  readiness: { ready: true, blockers: [], warnings: [] },
  validationWarnings: [],
  compatiblePublishers: [
    {
      id: 'wordpress',
      displayName: 'WordPress',
      enabled: true,
      compatible: true,
      gaps: [],
    },
  ],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  preview: { title: 'Photo', slug: 'photo', body: '<p>Publish-ready content for photo.</p>' },
};

function makeMockComposer(overrides: Partial<ContentComposerService> = {}): ContentComposerService {
  return {
    listEligibleAssets: vi.fn().mockResolvedValue({
      assets: [listItem],
      total: 1,
      limit: 50,
      offset: 0,
    }),
    getComposerAsset: vi.fn().mockResolvedValue(detailFixture),
    validate: vi.fn().mockResolvedValue({
      ready: true,
      messages: [],
      warnings: [],
      publisherCompatibility: {
        publisherId: 'wordpress',
        compatible: true,
        gaps: [],
      },
      missingRequirements: [],
    }),
    ...overrides,
  };
}

let app: ReturnType<typeof buildApp> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /composer/assets', () => {
  it('returns eligible assets', async () => {
    const composer = makeMockComposer();
    app = buildApp({ config: baseConfig, composerService: composer });
    const res = await app.inject({ method: 'GET', url: '/composer/assets' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { assets: ComposerAssetListItem[] };
    expect(body.assets[0]?.readiness).toBe('ready');
    expect(composer.listEligibleAssets).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-abc' }),
    );
  });

  it('returns 503 when composer absent', async () => {
    app = buildApp({ config: baseConfig });
    const res = await app.inject({ method: 'GET', url: '/composer/assets' });
    expect(res.statusCode).toBe(503);
  });
});

describe('GET /composer/assets/:id', () => {
  it('returns composer detail with SEO and readiness', async () => {
    app = buildApp({ config: baseConfig, composerService: makeMockComposer() });
    const res = await app.inject({ method: 'GET', url: '/composer/assets/asset-001' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as ComposerAssetDetail;
    expect(body.seo.slug).toBe('photo');
    expect(body.readiness.ready).toBe(true);
    expect(body.compatiblePublishers).toHaveLength(1);
  });

  it('returns 404 for missing asset', async () => {
    app = buildApp({
      config: baseConfig,
      composerService: makeMockComposer({
        getComposerAsset: vi.fn().mockResolvedValue(null),
      }),
    });
    const res = await app.inject({ method: 'GET', url: '/composer/assets/missing' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /composer/validate', () => {
  it('validates asset and publisher', async () => {
    const composer = makeMockComposer();
    app = buildApp({ config: baseConfig, composerService: composer });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/validate',
      payload: { assetId: 'asset-001', publisherId: 'wordpress' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ready: boolean };
    expect(body.ready).toBe(true);
    expect(composer.validate).toHaveBeenCalledWith({
      projectId: 'proj-abc',
      assetId: 'asset-001',
      publisherId: 'wordpress',
    });
  });

  it('returns 400 when assetId missing', async () => {
    app = buildApp({ config: baseConfig, composerService: makeMockComposer() });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/validate',
      payload: { publisherId: 'wordpress' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns not ready with messages', async () => {
    app = buildApp({
      config: baseConfig,
      composerService: makeMockComposer({
        validate: vi.fn().mockResolvedValue({
          ready: false,
          messages: ['Publisher is not enabled'],
          warnings: [],
          publisherCompatibility: {
            publisherId: 'wordpress',
            compatible: false,
            gaps: ['Publisher is not enabled'],
          },
          missingRequirements: ['WORDPRESS_URL: Site URL'],
        }),
      }),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/validate',
      payload: { assetId: 'asset-001', publisherId: 'wordpress' },
    });
    const body = res.json() as { ready: boolean; messages: string[] };
    expect(body.ready).toBe(false);
    expect(body.messages).toContain('Publisher is not enabled');
  });
});
