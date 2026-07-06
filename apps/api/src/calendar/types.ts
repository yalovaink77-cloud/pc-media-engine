/**
 * Publishing calendar DTOs — Sprint 43.
 */

export type CalendarEventStatus = 'waiting' | 'delayed' | 'active' | 'failed' | 'completed';

export type CalendarEvent = {
  id: string;
  jobId: string;
  assetId?: string;
  projectId?: string;
  publisher: string;
  title: string;
  slug: string;
  scheduledFor: string;
  status: CalendarEventStatus;
  retryCount: number;
  maxAttempts: number;
};

export type CalendarEventsQuery = {
  start: string;
  end: string;
  publisher?: string;
  status?: string;
  projectId?: string;
};

export type CalendarEventsResult = {
  events: CalendarEvent[];
  count: number;
  start: string;
  end: string;
};

export type TimelineEntryType =
  'queued' | 'scheduled' | 'published' | 'failed' | 'duplicate_skipped';

export type TimelineEntry = {
  id: string;
  timestamp: string;
  type: TimelineEntryType;
  assetId?: string;
  projectId?: string;
  publisher: string;
  title: string;
  slug: string;
  jobId?: string;
  scheduledFor?: string;
  retryCount?: number;
  message?: string;
};

export type CalendarTimelineQuery = {
  start?: string;
  end?: string;
  publisher?: string;
  projectId?: string;
  limit?: number;
};

export type CalendarTimelineResult = {
  entries: TimelineEntry[];
  count: number;
};

export interface CalendarService {
  listEvents(query: CalendarEventsQuery): Promise<CalendarEventsResult>;
  listTimeline(query: CalendarTimelineQuery): Promise<CalendarTimelineResult>;
}

export const DEFAULT_TIMELINE_LIMIT = 100;
export const MAX_TIMELINE_LIMIT = 500;
