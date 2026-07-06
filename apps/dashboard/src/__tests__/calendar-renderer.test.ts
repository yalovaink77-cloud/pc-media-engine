import { describe, expect, it } from 'vitest';

import { renderCalendarPage } from '../renderer.js';
import type { CalendarPageData } from '../types.js';

const future = '2026-08-15T14:00:00.000Z';

function makePageData(overrides: Partial<CalendarPageData> = {}): CalendarPageData {
  return {
    view: 'month',
    events: {
      events: [
        {
          id: 'job-1',
          jobId: 'job-1',
          assetId: 'asset-001',
          publisher: 'wordpress',
          title: 'Post',
          slug: 'post',
          scheduledFor: future,
          status: 'delayed',
          retryCount: 1,
          maxAttempts: 4,
        },
      ],
      count: 1,
      start: '2026-08-01T00:00:00.000Z',
      end: '2026-08-31T23:59:59.999Z',
    },
    timeline: {
      entries: [
        {
          id: 'tl-1',
          timestamp: future,
          type: 'scheduled',
          publisher: 'wordpress',
          title: 'Post',
          slug: 'post',
          jobId: 'job-1',
          retryCount: 0,
        },
      ],
      count: 1,
    },
    selectedEvent: null,
    rangeStart: '2026-08-01T00:00:00.000Z',
    rangeEnd: '2026-08-31T23:59:59.999Z',
    fetchedAt: '2026-08-01T12:00:00.000Z',
    errors: [],
    apiBaseUrl: 'http://api.test',
    ...overrides,
  };
}

describe('renderCalendarPage', () => {
  it('renders month view with events', () => {
    const html = renderCalendarPage(makePageData());
    expect(html).toContain('Publishing Calendar');
    expect(html).toContain('data-testid="calendar-month-view"');
    expect(html).toContain('data-testid="calendar-view-tabs"');
  });

  it('renders list view', () => {
    const html = renderCalendarPage(makePageData({ view: 'list' }));
    expect(html).toContain('data-testid="calendar-list-view"');
    expect(html).toContain('data-testid="calendar-event-row-job-1"');
  });

  it('renders timeline view', () => {
    const html = renderCalendarPage(makePageData({ view: 'timeline' }));
    expect(html).toContain('data-testid="calendar-timeline-view"');
    expect(html).toContain('data-testid="timeline-entry-tl-1"');
  });

  it('shows event detail panel', () => {
    const html = renderCalendarPage(
      makePageData({
        selectedEvent: makePageData().events!.events[0]!,
        selectedEventId: 'job-1',
      }),
    );
    expect(html).toContain('data-testid="calendar-event-detail"');
    expect(html).toContain('Retries');
  });

  it('includes calendar nav link', () => {
    const html = renderCalendarPage(makePageData());
    expect(html).toContain('href="/calendar"');
    expect(html).toContain('nav-active');
  });
});
