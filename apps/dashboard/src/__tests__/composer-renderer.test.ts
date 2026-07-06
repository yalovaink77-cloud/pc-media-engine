import { describe, expect, it } from 'vitest';

import { renderComposerPage } from '../renderer.js';
import type { ComposerPageData } from '../types.js';

const composerAsset = {
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
    excerpt: 'Excerpt text',
    metaDescription: 'Meta description',
    readingTimeMinutes: 1,
    tags: [],
    categories: [],
  },
  ai: { provider: 'none', aiApplied: false, message: 'Deterministic' },
  readiness: { ready: true, blockers: [], warnings: [] },
  validationWarnings: [],
  compatiblePublishers: [
    { id: 'wordpress', displayName: 'WordPress', enabled: true, compatible: true, gaps: [] },
  ],
  publishingHistory: [],
  publishingSummary: { total: 0, publishers: [] },
  preview: { title: 'Photo', slug: 'photo', body: '<p>Body</p>' },
};

function makePageData(overrides: Partial<ComposerPageData> = {}): ComposerPageData {
  return {
    assets: {
      assets: [
        {
          id: 'asset-001',
          projectId: 'proj-abc',
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          status: 'ready',
          readiness: 'ready',
          publisherCount: 0,
          createdAt: '2024-06-01T10:00:00.000Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    },
    selectedAsset: composerAsset,
    selectedAssetId: 'asset-001',
    validateResult: null,
    fetchedAt: '2024-06-01T12:00:00.000Z',
    errors: [],
    apiBaseUrl: 'http://api.test',
    ...overrides,
  };
}

describe('renderComposerPage', () => {
  it('renders asset selector and detail sections', () => {
    const html = renderComposerPage(makePageData());
    expect(html).toContain('Content Composer');
    expect(html).toContain('data-testid="composer-asset-selector"');
    expect(html).toContain('data-testid="composer-detail-section"');
    expect(html).toContain('data-testid="composer-readiness-badge"');
    expect(html).toContain('data-testid="composer-seo-section"');
    expect(html).toContain('data-testid="composer-ai-section"');
    expect(html).toContain('data-testid="composer-publisher-section"');
    expect(html).toContain('data-testid="composer-validate-button"');
  });

  it('shows validation result when present', () => {
    const html = renderComposerPage(
      makePageData({
        validateResult: {
          ready: false,
          messages: ['Publisher is not enabled'],
          warnings: ['Duplicate slug'],
          publisherCompatibility: {
            publisherId: 'wordpress',
            compatible: false,
            gaps: ['Not enabled'],
          },
          missingRequirements: ['WORDPRESS_URL'],
        },
        selectedPublisherId: 'wordpress',
      }),
    );
    expect(html).toContain('data-testid="composer-validation-result"');
    expect(html).toContain('Publisher is not enabled');
    expect(html).toContain('Duplicate slug');
  });

  it('shows empty state without selected asset', () => {
    const html = renderComposerPage(
      makePageData({ selectedAsset: null, selectedAssetId: undefined }),
    );
    expect(html).toContain('data-testid="composer-empty"');
  });

  it('includes composer nav link', () => {
    const html = renderComposerPage(makePageData());
    expect(html).toContain('href="/composer"');
    expect(html).toContain('nav-active');
  });
});
