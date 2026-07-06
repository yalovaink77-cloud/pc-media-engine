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
    { id: 'ghost', displayName: 'Ghost', enabled: true, compatible: true, gaps: [] },
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
    publishResult: null,
    fetchedAt: '2024-06-01T12:00:00.000Z',
    errors: [],
    apiBaseUrl: 'http://api.test',
    ...overrides,
  };
}

describe('renderComposerPage', () => {
  it('renders asset selector and publish controls', () => {
    const html = renderComposerPage(makePageData());
    expect(html).toContain('Content Composer');
    expect(html).toContain('data-testid="composer-asset-selector"');
    expect(html).toContain('data-testid="composer-detail-section"');
    expect(html).toContain('data-testid="composer-readiness-badge"');
    expect(html).toContain('data-testid="composer-seo-section"');
    expect(html).toContain('data-testid="composer-ai-section"');
    expect(html).toContain('data-testid="composer-publisher-section"');
    expect(html).toContain('data-testid="composer-publish-button"');
    expect(html).toContain('data-testid="composer-publisher-multiselect"');
  });

  it('shows confirmation dialog when confirmPublish set', () => {
    const html = renderComposerPage(
      makePageData({
        confirmPublish: true,
        selectedPublisherIds: ['wordpress', 'ghost'],
      }),
    );
    expect(html).toContain('data-testid="composer-confirm-dialog"');
    expect(html).toContain('data-testid="composer-confirm-button"');
  });

  it('shows publish result summary when present', () => {
    const html = renderComposerPage(
      makePageData({
        publishResult: {
          assetId: 'asset-001',
          accepted: [{ publisherId: 'wordpress', jobId: 'job-1' }],
          skipped: [{ publisherId: 'ghost', reason: 'Duplicate slug' }],
          failures: [{ publisherId: 'unknown', reason: 'Not registered' }],
        },
      }),
    );
    expect(html).toContain('data-testid="composer-publish-result"');
    expect(html).toContain('data-testid="publish-queued-wordpress"');
    expect(html).toContain('data-testid="publish-skipped-ghost"');
    expect(html).toContain('data-testid="publish-failure-unknown"');
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
