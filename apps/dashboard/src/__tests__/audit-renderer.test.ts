/**
 * Activity dashboard renderer tests — Sprint 46.
 */

import { describe, expect, it } from 'vitest';

import { renderActivityPage } from '../renderer.js';

const sampleEvent = {
  id: 'evt-abc',
  type: 'queue.pause',
  category: 'queue',
  severity: 'info' as const,
  actor: { type: 'user', id: 'admin', role: 'admin' },
  target: { type: 'queue', id: 'publishing' },
  correlationId: 'corr-123',
  metadata: { paused: true },
  timestamp: '2026-07-06T12:00:00.000Z',
};

describe('renderActivityPage', () => {
  it('renders timeline with severity badges', () => {
    const html = renderActivityPage({
      events: { events: [sampleEvent], total: 1, limit: 50 },
      selectedEvent: null,
      filters: {},
      fetchedAt: 'now',
      errors: [],
    });
    expect(html).toContain('data-testid="activity-section"');
    expect(html).toContain('data-testid="activity-timeline"');
    expect(html).toContain('data-testid="activity-row-evt-abc"');
    expect(html).toContain('queue.pause');
  });

  it('renders event detail with correlation id and metadata', () => {
    const html = renderActivityPage({
      events: { events: [sampleEvent], total: 1, limit: 50 },
      selectedEvent: sampleEvent,
      filters: {},
      fetchedAt: 'now',
      errors: [],
    });
    expect(html).toContain('data-testid="activity-event-detail"');
    expect(html).toContain('data-testid="activity-correlation"');
    expect(html).toContain('corr-123');
    expect(html).toContain('data-testid="activity-metadata"');
  });

  it('includes activity nav link', () => {
    const html = renderActivityPage({
      events: { events: [], total: 0, limit: 50 },
      selectedEvent: null,
      filters: {},
      fetchedAt: 'now',
      errors: [],
    });
    expect(html).toContain('href="/activity"');
  });
});
