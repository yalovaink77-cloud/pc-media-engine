import { describe, expect, it } from 'vitest';

import { renderAssetDetailPage, renderAssetsPage } from '../renderer.js';
import type { AssetDetail, AssetsPageData } from '../types.js';

const assetListItem = {
  id: 'asset-001',
  projectId: 'proj-abc',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 204800,
  status: 'ready',
  dimensions: { width: 1920, height: 1080 },
  thumbnail: { url: '/assets/asset-001/thumbnail', mimeType: 'image/webp' },
  publisherCount: 2,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:05:00.000Z',
};

function makeAssetsPageData(overrides: Partial<AssetsPageData> = {}): AssetsPageData {
  return {
    result: { assets: [assetListItem], total: 1, limit: 50, offset: 0 },
    filters: {},
    fetchedAt: '2024-06-01T12:00:00.000Z',
    errors: [],
    apiBaseUrl: 'http://api.test',
    ...overrides,
  };
}

describe('renderAssetsPage', () => {
  it('renders assets table with preview and status', () => {
    const html = renderAssetsPage(makeAssetsPageData());
    expect(html).toContain('Asset Library');
    expect(html).toContain('data-testid="assets-table"');
    expect(html).toContain('data-testid="asset-row-asset-001"');
    expect(html).toContain('photo.jpg');
    expect(html).toContain('href="/assets/asset-001"');
    expect(html).toContain('ready');
    expect(html).toContain('data-testid="asset-thumb"');
  });

  it('renders filter form', () => {
    const html = renderAssetsPage(makeAssetsPageData({ filters: { status: 'ready' } }));
    expect(html).toContain('data-testid="assets-filter-form"');
    expect(html).toContain('value="ready" selected');
  });

  it('shows unavailable state', () => {
    const html = renderAssetsPage(makeAssetsPageData({ result: null, errors: ['unavailable'] }));
    expect(html).toContain('data-testid="assets-unavailable"');
  });

  it('includes assets nav link', () => {
    const html = renderAssetsPage(makeAssetsPageData());
    expect(html).toContain('href="/assets"');
    expect(html).toContain('nav-active');
  });
});

describe('renderAssetDetailPage', () => {
  const detail: AssetDetail = {
    ...assetListItem,
    originalFilename: 'photo.jpg',
    storageKey: 'proj/photo.jpg',
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

  it('renders metadata, timeline, and publishing history', () => {
    const html = renderAssetDetailPage({
      asset: detail,
      fetchedAt: '2024-06-01T12:00:00.000Z',
      errors: [],
      apiBaseUrl: 'http://api.test',
    });
    expect(html).toContain('data-testid="asset-detail-section"');
    expect(html).toContain('data-testid="processing-timeline-table"');
    expect(html).toContain('data-testid="publishing-history-table"');
    expect(html).toContain('data-testid="asset-download-link"');
    expect(html).toContain('http://api.test/assets/asset-001/download');
  });

  it('shows unavailable when asset missing', () => {
    const html = renderAssetDetailPage({
      asset: null,
      fetchedAt: '2024-06-01T12:00:00.000Z',
      errors: ['not found'],
      apiBaseUrl: 'http://api.test',
    });
    expect(html).toContain('data-testid="asset-unavailable"');
  });
});
