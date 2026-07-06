import { describe, expect, it } from 'vitest';

import { renderBulkPublishPage } from '../renderer.js';
import type { BulkPublishPageData, PublisherListItem } from '../types.js';

const publishers: PublisherListItem[] = [
  {
    id: 'wordpress',
    displayName: 'WordPress',
    version: '1.0.0',
    enabled: true,
    capabilities: {
      mediaUpload: true,
      postCreation: true,
      drafts: true,
      tags: true,
      categories: true,
      featuredImages: true,
      scheduling: false,
      update: false,
      delete: false,
    },
    supportsHealthCheck: true,
  },
];

function makePageData(overrides: Partial<BulkPublishPageData> = {}): BulkPublishPageData {
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
    publishers,
    selectedAssetIds: ['asset-001'],
    selectedPublisherIds: ['wordpress'],
    bulkResult: null,
    fetchedAt: '2024-06-01T12:00:00.000Z',
    errors: [],
    apiBaseUrl: 'http://api.test',
    ...overrides,
  };
}

describe('renderBulkPublishPage', () => {
  it('renders selectors and summary panel', () => {
    const html = renderBulkPublishPage(makePageData());
    expect(html).toContain('Bulk Publish');
    expect(html).toContain('data-testid="bulk-publish-section"');
    expect(html).toContain('data-testid="bulk-asset-multiselect"');
    expect(html).toContain('data-testid="bulk-publisher-multiselect"');
    expect(html).toContain('data-testid="bulk-publish-summary-panel"');
    expect(html).toContain('data-testid="bulk-publish-button"');
  });

  it('shows confirmation dialog when confirmBulkPublish set', () => {
    const html = renderBulkPublishPage(makePageData({ confirmBulkPublish: true }));
    expect(html).toContain('data-testid="bulk-confirm-dialog"');
    expect(html).toContain('data-testid="bulk-confirm-button"');
  });

  it('shows bulk result summary when present', () => {
    const html = renderBulkPublishPage(
      makePageData({
        bulkResult: {
          accepted: [{ assetId: 'asset-001', publisherId: 'wordpress', jobId: 'job-1' }],
          skipped: [{ assetId: 'asset-001', publisherId: 'ghost', reason: 'Duplicate' }],
          failures: [{ assetId: 'asset-002', publisherId: 'unknown', reason: 'Not registered' }],
          summary: { assets: 2, publishers: 2, pairs: 4, accepted: 1, skipped: 1, failures: 1 },
        },
      }),
    );
    expect(html).toContain('data-testid="bulk-publish-result"');
    expect(html).toContain('data-testid="bulk-queued-asset-001-wordpress"');
    expect(html).toContain('data-testid="bulk-skipped-asset-001-ghost"');
    expect(html).toContain('data-testid="bulk-failure-asset-002-unknown"');
  });

  it('includes bulk publish nav link', () => {
    const html = renderBulkPublishPage(makePageData());
    expect(html).toContain('href="/bulk-publish"');
    expect(html).toContain('nav-active');
  });
});
