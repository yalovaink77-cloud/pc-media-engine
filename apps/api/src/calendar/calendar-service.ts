import type { PublishedContent } from '@pcme/database';

import type { JobListItem } from '../queue/job-types.js';
import type { QueueService } from '../queue/queue-service.js';
import type { PublishedContentFinder } from '../routes/publishing.js';
import type {
  CalendarEvent,
  CalendarEventsQuery,
  CalendarEventsResult,
  CalendarService,
  CalendarTimelineQuery,
  CalendarTimelineResult,
  TimelineEntry,
  TimelineEntryType,
} from './types.js';
import { DEFAULT_TIMELINE_LIMIT, MAX_TIMELINE_LIMIT } from './types.js';

export type CalendarServiceDeps = {
  queueService?: QueueService;
  publishedContentRepo?: PublishedContentFinder;
  publisherDriver?: string;
};

function parseIso(value: string, label: string): Date {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`${label} must be a valid ISO 8601 datetime`);
  }
  return new Date(ms);
}

function eventScheduledTime(job: JobListItem, payloadScheduledFor?: string): string {
  if (job.scheduledFor) return job.scheduledFor;
  if (payloadScheduledFor) return payloadScheduledFor;
  return job.createdAt;
}

function mapJobStatusToTimelineType(status: string, hasScheduledFor: boolean): TimelineEntryType {
  if (status === 'delayed' || hasScheduledFor) return 'scheduled';
  if (status === 'waiting' || status === 'active') return 'queued';
  if (status === 'failed') return 'failed';
  return 'queued';
}

async function fetchAllJobs(
  deps: CalendarServiceDeps,
  query: { publisher?: string; projectId?: string; status?: string },
): Promise<JobListItem[]> {
  if (!deps.queueService) return [];

  const result = await deps.queueService.listJobs(
    {
      publisher: query.publisher,
      projectId: query.projectId,
      status: query.status,
      limit: 2000,
      offset: 0,
    },
    deps.publisherDriver ?? 'mock',
  );
  return result.jobs;
}

async function fetchJobPayloads(
  deps: CalendarServiceDeps,
  jobIds: string[],
): Promise<Map<string, { scheduledFor?: string }>> {
  const map = new Map<string, { scheduledFor?: string }>();
  if (!deps.queueService) return map;

  await Promise.all(
    jobIds.map(async (id) => {
      try {
        const detail = await deps.queueService!.getJob(id, deps.publisherDriver ?? 'mock');
        map.set(id, { scheduledFor: detail.payload.scheduledFor ?? detail.scheduledTime });
      } catch {
        // job may have been removed
      }
    }),
  );
  return map;
}

function historyKey(record: PublishedContent): string {
  return `${record.projectId}:${record.publisher}:${record.slug}`;
}

export function createCalendarService(deps: CalendarServiceDeps): CalendarService {
  return {
    async listEvents(query: CalendarEventsQuery): Promise<CalendarEventsResult> {
      const start = parseIso(query.start, 'start');
      const end = parseIso(query.end, 'end');

      const jobs = await fetchAllJobs(deps, {
        publisher: query.publisher,
        projectId: query.projectId,
        status: query.status,
      });

      const payloadMap = await fetchJobPayloads(
        deps,
        jobs.map((j) => j.id),
      );

      const events: CalendarEvent[] = [];

      for (const job of jobs) {
        if (query.publisher && job.publisher !== query.publisher) continue;

        const payloadMeta = payloadMap.get(job.id);
        const scheduledFor = eventScheduledTime(job, payloadMeta?.scheduledFor);
        const scheduledMs = Date.parse(scheduledFor);
        if (Number.isNaN(scheduledMs)) continue;
        if (scheduledMs < start.getTime() || scheduledMs > end.getTime()) continue;

        const isScheduled = job.status === 'delayed' || Boolean(job.scheduledFor);
        if (!isScheduled && query.status === 'delayed') continue;
        if (!isScheduled) continue;

        events.push({
          id: job.id,
          jobId: job.id,
          assetId: job.assetId,
          projectId: job.projectId,
          publisher: job.publisher,
          title: job.title,
          slug: job.slug,
          scheduledFor,
          status: job.status as CalendarEvent['status'],
          retryCount: job.retryCount,
          maxAttempts: job.maxAttempts,
        });
      }

      events.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

      return {
        events,
        count: events.length,
        start: start.toISOString(),
        end: end.toISOString(),
      };
    },

    async listTimeline(query: CalendarTimelineQuery): Promise<CalendarTimelineResult> {
      const limit = Math.min(
        Math.max(query.limit ?? DEFAULT_TIMELINE_LIMIT, 1),
        MAX_TIMELINE_LIMIT,
      );
      const startMs = query.start ? Date.parse(query.start) : Number.NEGATIVE_INFINITY;
      const endMs = query.end ? Date.parse(query.end) : Number.POSITIVE_INFINITY;

      const jobs = await fetchAllJobs(deps, {
        publisher: query.publisher,
        projectId: query.projectId,
      });

      const payloadMap = await fetchJobPayloads(
        deps,
        jobs.map((j) => j.id),
      );

      const publishedKeys = new Set<string>();
      const historyRecords: PublishedContent[] = [];

      if (deps.publishedContentRepo) {
        const history = await deps.publishedContentRepo.findHistory({
          projectId: query.projectId,
          publisher: query.publisher,
          limit: MAX_TIMELINE_LIMIT,
        });
        historyRecords.push(...history);
        for (const record of history) {
          publishedKeys.add(historyKey(record));
        }
      }

      const entries: TimelineEntry[] = [];

      for (const job of jobs) {
        if (query.publisher && job.publisher !== query.publisher) continue;

        const payloadMeta = payloadMap.get(job.id);
        const scheduledFor =
          job.scheduledFor ?? (job.status === 'delayed' ? payloadMeta?.scheduledFor : undefined);
        const hasScheduledFor = Boolean(scheduledFor);
        const timestamp =
          job.status === 'completed' || job.status === 'failed'
            ? (job.updatedAt ?? job.createdAt)
            : hasScheduledFor
              ? scheduledFor!
              : job.createdAt;

        const ts = Date.parse(timestamp);
        if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;

        if (job.status === 'completed') {
          const key = `${job.projectId ?? ''}:${job.publisher}:${job.slug}`;
          if (publishedKeys.has(key)) {
            entries.push({
              id: `job-${job.id}`,
              timestamp: new Date(ts).toISOString(),
              type: 'published',
              assetId: job.assetId,
              projectId: job.projectId,
              publisher: job.publisher,
              title: job.title,
              slug: job.slug,
              jobId: job.id,
              retryCount: job.retryCount,
            });
          } else {
            entries.push({
              id: `job-${job.id}`,
              timestamp: new Date(ts).toISOString(),
              type: 'duplicate_skipped',
              assetId: job.assetId,
              projectId: job.projectId,
              publisher: job.publisher,
              title: job.title,
              slug: job.slug,
              jobId: job.id,
              message: 'Duplicate slug detected at execution time',
            });
          }
          continue;
        }

        const type = mapJobStatusToTimelineType(job.status, hasScheduledFor);
        entries.push({
          id: `job-${job.id}`,
          timestamp: new Date(ts).toISOString(),
          type,
          assetId: job.assetId,
          projectId: job.projectId,
          publisher: job.publisher,
          title: job.title,
          slug: job.slug,
          jobId: job.id,
          scheduledFor: hasScheduledFor ? scheduledFor : undefined,
          retryCount: job.retryCount,
        });
      }

      for (const record of historyRecords) {
        const ts = record.publishedAt.getTime();
        if (ts < startMs || ts > endMs) continue;
        if (query.publisher && record.publisher !== query.publisher) continue;
        if (query.projectId && record.projectId !== query.projectId) continue;

        entries.push({
          id: `history-${record.id}`,
          timestamp: record.publishedAt.toISOString(),
          type: 'published',
          assetId: record.assetId,
          projectId: record.projectId,
          publisher: record.publisher,
          title: record.slug,
          slug: record.slug,
          message: record.url,
        });
      }

      entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      return {
        entries: entries.slice(0, limit),
        count: Math.min(entries.length, limit),
      };
    },
  };
}

/** Exported for tests — map raw BullMQ job list item to calendar event. */
export function jobToCalendarEvent(job: JobListItem, scheduledFor: string): CalendarEvent {
  return {
    id: job.id,
    jobId: job.id,
    assetId: job.assetId,
    projectId: job.projectId,
    publisher: job.publisher,
    title: job.title,
    slug: job.slug,
    scheduledFor,
    status: job.status as CalendarEvent['status'],
    retryCount: job.retryCount,
    maxAttempts: job.maxAttempts,
  };
}
