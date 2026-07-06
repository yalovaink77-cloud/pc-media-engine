import { describe, expect, it } from 'vitest';

import { renderJobDetailPage, renderJobsPage } from '../renderer.js';
import type { JobsPageData } from '../types.js';

const jobListItem = {
  id: 'job-001',
  name: 'publish',
  status: 'failed',
  publisher: 'mock',
  projectId: 'proj-abc',
  assetId: 'asset-xyz',
  title: 'Test Article',
  slug: 'test-article',
  retryCount: 2,
  maxAttempts: 4,
  createdAt: '2024-06-01T10:00:00.000Z',
  updatedAt: '2024-06-01T10:05:00.000Z',
};

function makeJobsPageData(overrides: Partial<JobsPageData> = {}): JobsPageData {
  return {
    result: { jobs: [jobListItem], total: 1, limit: 50, offset: 0 },
    filters: {},
    fetchedAt: '2024-06-01T12:00:00.000Z',
    errors: [],
    apiKeyConfigured: true,
    ...overrides,
  };
}

describe('renderJobsPage', () => {
  it('renders jobs table with status badges', () => {
    const html = renderJobsPage(makeJobsPageData());
    expect(html).toContain('Publishing Jobs');
    expect(html).toContain('data-testid="jobs-table"');
    expect(html).toContain('data-testid="job-row-job-001"');
    expect(html).toContain('failed');
    expect(html).toContain('href="/jobs/job-001"');
  });

  it('renders filter form', () => {
    const html = renderJobsPage(makeJobsPageData({ filters: { status: 'failed' } }));
    expect(html).toContain('data-testid="jobs-filter-form"');
    expect(html).toContain('value="failed" selected');
  });

  it('shows unavailable state', () => {
    const html = renderJobsPage(makeJobsPageData({ result: null, errors: ['unavailable'] }));
    expect(html).toContain('data-testid="jobs-unavailable"');
  });

  it('includes jobs nav link', () => {
    const html = renderJobsPage(makeJobsPageData());
    expect(html).toContain('href="/jobs"');
    expect(html).toContain('nav-active');
  });
});

describe('renderJobDetailPage', () => {
  const detail = {
    ...jobListItem,
    payload: {
      title: 'Test Article',
      slug: 'test-article',
      projectId: 'proj-abc',
      assetId: 'asset-xyz',
      hasMedia: true,
      mediaMimeType: 'image/jpeg',
    },
    queueState: 'failed',
    retryHistory: [{ attempt: 1, error: 'timeout' }],
    queuePaused: false,
    error: { message: 'Publisher down' },
  };

  it('renders metadata and payload sections', () => {
    const html = renderJobDetailPage({
      job: detail,
      fetchedAt: '2024-06-01T12:00:00.000Z',
      errors: [],
      apiKeyConfigured: true,
    });
    expect(html).toContain('data-testid="job-detail-section"');
    expect(html).toContain('Payload Summary');
    expect(html).toContain('Retry History');
    expect(html).toContain('Publisher down');
  });

  it('renders queue action forms for failed job', () => {
    const html = renderJobDetailPage({
      job: detail,
      fetchedAt: '2024-06-01T12:00:00.000Z',
      errors: [],
      apiKeyConfigured: true,
    });
    expect(html).toContain('data-testid="job-retry-form"');
    expect(html).toContain('data-testid="job-remove-form"');
    expect(html).toContain('/ops/jobs/job-001/retry');
  });

  it('shows unavailable when job missing', () => {
    const html = renderJobDetailPage({
      job: null,
      fetchedAt: '2024-06-01T12:00:00.000Z',
      errors: ['not found'],
      apiKeyConfigured: false,
    });
    expect(html).toContain('data-testid="job-unavailable"');
  });
});
