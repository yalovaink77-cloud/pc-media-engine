import { describe, expect, it, vi } from 'vitest';

import { createCalendarService } from '../calendar/calendar-service.js';
import type { CalendarEvent } from '../calendar/types.js';
import type { JobDetail, JobListItem } from '../queue/job-types.js';
import type { QueueService } from '../queue/queue-service.js';

const delayedJob: JobListItem = {
  id: 'job-delayed-1',
  name: 'publish',
  status: 'delayed',
  publisher: 'wordpress',
  projectId: 'proj-1',
  assetId: 'asset-1',
  title: 'Scheduled Post',
  slug: 'scheduled-post',
  retryCount: 0,
  maxAttempts: 4,
  createdAt: '2026-07-01T10:00:00.000Z',
  scheduledFor: '2026-07-10T14:00:00.000Z',
};

function makeQueueService(jobs: JobListItem[] = [delayedJob]): QueueService {
  const jobDetail: JobDetail = {
    ...delayedJob,
    payload: {
      title: delayedJob.title,
      slug: delayedJob.slug,
      scheduledFor: delayedJob.scheduledFor,
      hasMedia: true,
      projectId: delayedJob.projectId,
      assetId: delayedJob.assetId,
      publisherId: delayedJob.publisher,
    },
    queueState: 'delayed',
    scheduledTime: delayedJob.scheduledFor,
    retryHistory: [],
    queuePaused: false,
  };

  return {
    getStatus: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    drain: vi.fn(),
    retryJob: vi.fn(),
    removeJob: vi.fn(),
    listJobs: vi.fn().mockResolvedValue({ jobs, total: jobs.length, limit: 2000, offset: 0 }),
    getJob: vi.fn().mockResolvedValue(jobDetail),
  };
}

describe('createCalendarService', () => {
  it('lists events within date range', async () => {
    const service = createCalendarService({ queueService: makeQueueService() });
    const result = await service.listEvents({
      start: '2026-07-01T00:00:00.000Z',
      end: '2026-07-31T23:59:59.999Z',
    });
    expect(result.count).toBe(1);
    expect(result.events[0]?.jobId).toBe('job-delayed-1');
    expect(result.events[0]?.scheduledFor).toBe('2026-07-10T14:00:00.000Z');
  });

  it('filters events by publisher', async () => {
    const service = createCalendarService({
      queueService: makeQueueService([
        delayedJob,
        {
          ...delayedJob,
          id: 'job-2',
          publisher: 'ghost',
          scheduledFor: '2026-07-11T10:00:00.000Z',
        },
      ]),
    });
    const result = await service.listEvents({
      start: '2026-07-01T00:00:00.000Z',
      end: '2026-07-31T23:59:59.999Z',
      publisher: 'wordpress',
    });
    expect(result.events.every((e) => e.publisher === 'wordpress')).toBe(true);
  });

  it('returns timeline entries in chronological order', async () => {
    const waiting: JobListItem = {
      ...delayedJob,
      id: 'job-waiting',
      status: 'waiting',
      scheduledFor: undefined,
      createdAt: '2026-07-05T08:00:00.000Z',
    };
    const service = createCalendarService({
      queueService: makeQueueService([delayedJob, waiting]),
      publishedContentRepo: {
        findHistory: vi.fn().mockResolvedValue([]),
        findById: vi.fn(),
      },
    });
    const result = await service.listTimeline({
      start: '2026-07-01T00:00:00.000Z',
      end: '2026-07-31T23:59:59.999Z',
    });
    expect(result.entries.length).toBeGreaterThanOrEqual(2);
    expect(result.entries[0]!.timestamp <= result.entries[1]!.timestamp).toBe(true);
    expect(result.entries.some((e) => e.type === 'scheduled')).toBe(true);
    expect(result.entries.some((e) => e.type === 'queued')).toBe(true);
  });
});

describe('jobToCalendarEvent', () => {
  it('maps job fields to calendar event', async () => {
    const { jobToCalendarEvent } = await import('../calendar/calendar-service.js');
    const event: CalendarEvent = jobToCalendarEvent(delayedJob, delayedJob.scheduledFor!);
    expect(event.retryCount).toBe(0);
    expect(event.publisher).toBe('wordpress');
  });
});
