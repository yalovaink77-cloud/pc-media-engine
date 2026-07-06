import { describe, expect, it } from 'vitest';

import { renderDashboardPage } from '../renderer.js';
import type { DashboardPageData } from '../types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW_ISO = '2024-06-01T12:00:00.000Z';

const healthFixture = {
  status: 'ok' as const,
  database: 'ok' as const,
  publishing: {
    publisherDriver: 'mock',
    queueEnabled: false,
    retryConfig: { maxRetries: 3, backoffMs: 5000 },
  },
  version: '0.0.0-test',
  env: 'test',
};

const summaryFixture = {
  totalPublished: 42,
  totalDrafts: 3,
  totalFailed: 1,
  latestPublishedAt: NOW_ISO,
  publishers: [
    { publisher: 'mock', count: 30 },
    { publisher: 'wordpress', count: 16 },
  ],
  duplicateDetectionEnabled: true,
  schedulerEnabled: true,
  retryEnabled: true,
  aiProvider: 'openrouter',
  publisherDriver: 'mock',
};

const recentFixture = {
  items: [
    {
      id: 'rec-001',
      projectId: 'proj-abc',
      assetId: 'asset-xyz',
      publisher: 'mock',
      externalId: 'ext-1',
      url: 'https://example.com/posts/first-article',
      status: 'published',
      publishedAt: NOW_ISO,
      createdAt: NOW_ISO,
    },
    {
      id: 'rec-002',
      projectId: 'proj-abc',
      assetId: 'asset-abc',
      publisher: 'wordpress',
      externalId: 'ext-2',
      url: 'https://example.com/posts/second-article',
      status: 'published',
      publishedAt: NOW_ISO,
      createdAt: NOW_ISO,
    },
  ],
  count: 2,
};

const metricsFixture = {
  uploadsTotal: 15,
  processedTotal: 12,
  publishedTotal: 10,
  retriesTotal: 2,
  failuresTotal: 1,
  duplicateSkipsTotal: 3,
  schedulerJobsTotal: 4,
  queueWaiting: 0,
  queueActive: 1,
  queueCompleted: 10,
  queueFailed: 1,
  collectedAt: NOW_ISO,
};

function makePageData(overrides: Partial<DashboardPageData> = {}): DashboardPageData {
  return {
    health: healthFixture,
    summary: summaryFixture,
    recent: recentFixture,
    metrics: metricsFixture,
    queueStatus: null,
    fetchedAt: NOW_ISO,
    errors: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Renderer tests
// ---------------------------------------------------------------------------

describe('renderDashboardPage — structure', () => {
  it('returns valid HTML5 document', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('includes page title', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('PC Media Engine');
  });

  it('includes fetchedAt timestamp', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain(NOW_ISO);
  });
});

describe('renderDashboardPage — health section', () => {
  it('renders health cards when health data is present', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="health-cards"');
  });

  it('renders publisher driver from health data', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('mock');
  });

  it('renders database status badge', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="health-cards"');
    expect(html).toContain('badge ok');
  });

  it('renders unavailable message when health is null', () => {
    const html = renderDashboardPage(makePageData({ health: null }));
    expect(html).toContain('data-testid="health-unavailable"');
    expect(html).toContain('Health data unavailable');
  });
});

describe('renderDashboardPage — summary cards', () => {
  it('renders totalPublished count', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="total-published"');
    expect(html).toContain('>42<');
  });

  it('renders totalDrafts count', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="total-drafts"');
    expect(html).toContain('>3<');
  });

  it('renders totalFailed count', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="total-failed"');
    expect(html).toContain('>1<');
  });

  it('renders latestPublishedAt field', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="latest-published-at"');
  });

  it('renders null latestPublishedAt as dash', () => {
    const html = renderDashboardPage(
      makePageData({ summary: { ...summaryFixture, latestPublishedAt: null } }),
    );
    expect(html).toContain('>—<');
  });

  it('renders unavailable message when summary is null', () => {
    const html = renderDashboardPage(makePageData({ summary: null }));
    expect(html).toContain('data-testid="summary-unavailable"');
    expect(html).toContain('Summary data unavailable');
  });
});

describe('renderDashboardPage — capabilities', () => {
  it('shows all three capability flags as yes', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="capabilities-cards"');
    // three "yes" badges expected
    const matches = html.match(/badge ok">yes<\/span>/g);
    expect(matches?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('renderDashboardPage — publisher breakdown', () => {
  it('renders publisher table', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="publisher-table"');
  });

  it('renders all publishers', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('mock');
    expect(html).toContain('wordpress');
  });

  it('renders publisher counts', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('>30<');
    expect(html).toContain('>16<');
  });
});

describe('renderDashboardPage — recent list', () => {
  it('renders recent table with rows', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="recent-table"');
    const rows = html.match(/data-testid="recent-row"/g);
    expect(rows).toHaveLength(2);
  });

  it('renders item URLs as links', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('https://example.com/posts/first-article');
  });

  it('renders publisher names in rows', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('wordpress');
  });

  it('shows empty message when recent has no items', () => {
    const html = renderDashboardPage(makePageData({ recent: { items: [], count: 0 } }));
    expect(html).toContain('data-testid="recent-empty"');
    expect(html).toContain('No published content yet');
  });

  it('shows unavailable message when recent is null', () => {
    const html = renderDashboardPage(makePageData({ recent: null }));
    expect(html).toContain('data-testid="recent-unavailable"');
    expect(html).toContain('Recent data unavailable');
  });
});

describe('renderDashboardPage — error state', () => {
  it('renders error banner when errors array is non-empty', () => {
    const html = renderDashboardPage(
      makePageData({
        health: null,
        summary: null,
        recent: null,
        errors: ['Could not reach /dashboard/health', 'Could not reach /dashboard/summary'],
      }),
    );
    expect(html).toContain('data-testid="error-banner"');
    expect(html).toContain('Could not reach /dashboard/health');
    expect(html).toContain('Could not reach /dashboard/summary');
  });

  it('does not render error banner when errors array is empty', () => {
    const html = renderDashboardPage(makePageData({ errors: [] }));
    expect(html).not.toContain('data-testid="error-banner"');
  });

  it('escapes HTML in error messages', () => {
    const html = renderDashboardPage(makePageData({ errors: ['<script>alert("xss")</script>'] }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderDashboardPage — metrics section', () => {
  it('renders metrics cards when metrics data is present', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="metrics-cards"');
  });

  it('renders upload count', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="metric-uploads"');
    expect(html).toContain('>15<');
  });

  it('renders published count', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="metric-published"');
    expect(html).toContain('>10<');
  });

  it('renders retry count', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="metric-retries"');
    expect(html).toContain('>2<');
  });

  it('renders failure count', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="metric-failures"');
    expect(html).toContain('>1<');
  });

  it('renders queue cards', () => {
    const html = renderDashboardPage(makePageData());
    expect(html).toContain('data-testid="queue-cards"');
  });

  it('shows unavailable message when metrics is null', () => {
    const html = renderDashboardPage(makePageData({ metrics: null }));
    expect(html).toContain('data-testid="metrics-unavailable"');
    expect(html).toContain('Metrics data unavailable');
  });
});

describe('renderDashboardPage — queue status section (Sprint 32)', () => {
  it('shows unavailable message when queueStatus is null', () => {
    const html = renderDashboardPage(makePageData({ queueStatus: null }));
    expect(html).toContain('data-testid="queue-status-unavailable"');
    expect(html).toContain('Queue status unavailable');
  });

  it('shows queue status cards when queueStatus is provided', () => {
    const html = renderDashboardPage(
      makePageData({
        queueStatus: {
          paused: false,
          waiting: 5,
          active: 2,
          delayed: 1,
          completed: 100,
          failed: 4,
        },
      }),
    );
    expect(html).toContain('data-testid="queue-status-cards"');
    expect(html).toContain('data-testid="queue-waiting"');
    expect(html).toContain('>5<');
    expect(html).toContain('data-testid="queue-active"');
    expect(html).toContain('>2<');
    expect(html).toContain('data-testid="queue-delayed"');
    expect(html).toContain('>1<');
    expect(html).toContain('data-testid="queue-completed"');
    expect(html).toContain('>100<');
    expect(html).toContain('data-testid="queue-failed"');
    expect(html).toContain('>4<');
  });

  it('shows "Running" badge when queue is not paused', () => {
    const html = renderDashboardPage(
      makePageData({
        queueStatus: { paused: false, waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 },
      }),
    );
    expect(html).toContain('data-testid="queue-running-badge"');
    expect(html).not.toContain('data-testid="queue-paused-badge"');
  });

  it('shows "Paused" badge when queue is paused', () => {
    const html = renderDashboardPage(
      makePageData({
        queueStatus: { paused: true, waiting: 3, active: 0, delayed: 0, completed: 5, failed: 0 },
      }),
    );
    expect(html).toContain('data-testid="queue-paused-badge"');
    expect(html).not.toContain('data-testid="queue-running-badge"');
  });
});

describe('renderDashboardPage — XSS escaping', () => {
  it('escapes publisher name containing HTML', () => {
    const xssPublisher = '<img src=x onerror=alert(1)>';
    const html = renderDashboardPage(
      makePageData({
        summary: {
          ...summaryFixture,
          publishers: [{ publisher: xssPublisher, count: 1 }],
        },
      }),
    );
    expect(html).not.toContain(xssPublisher);
    expect(html).toContain('&lt;img');
  });
});
