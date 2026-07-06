import { describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { AuthConfig } from '../auth/config.js';
import type { CalendarService } from '../calendar/types.js';
import type { ContentComposerService } from '../composer/types.js';
import type { PublishingQueueEnqueuer } from '../queue/publishing-enqueue.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.43.0-test',
  databaseUrl: 'postgres://test',
  storageLocalRoot: '/tmp/storage',
  defaultOrgId: 'org-1',
  defaultProjectId: 'proj-abc',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: 'redis://127.0.0.1:6379',
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: 'calendar-smoke-secret-at-least-32-chars',
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['smoke-key'],
  apiKeyRoles: {},
  defaultJwtRole: 'operator',
  defaultApiKeyRole: 'admin',
};

const future = new Date(Date.now() + 86_400_000).toISOString();

function makeCalendar(): CalendarService {
  return {
    listEvents: vi.fn().mockResolvedValue({
      events: [
        {
          id: 'job-1',
          jobId: 'job-1',
          assetId: 'asset-1',
          projectId: 'proj-abc',
          publisher: 'wordpress',
          title: 'Post',
          slug: 'post',
          scheduledFor: future,
          status: 'delayed',
          retryCount: 0,
          maxAttempts: 4,
        },
      ],
      count: 1,
      start: '2026-07-01T00:00:00.000Z',
      end: '2026-07-31T23:59:59.999Z',
    }),
    listTimeline: vi.fn().mockResolvedValue({
      entries: [
        {
          id: 'job-1',
          timestamp: future,
          type: 'scheduled',
          publisher: 'wordpress',
          title: 'Post',
          slug: 'post',
          jobId: 'job-1',
          scheduledFor: future,
        },
      ],
      count: 1,
    }),
  };
}

function makeComposer(): ContentComposerService {
  return {
    listEligibleAssets: vi.fn(),
    getComposerAsset: vi.fn(),
    validate: vi.fn(),
    publish: vi.fn(),
    schedule: vi.fn().mockResolvedValue({
      assetId: 'asset-1',
      scheduledFor: future,
      accepted: [{ publisherId: 'wordpress', jobId: 'job-1' }],
      skipped: [],
      failures: [],
    }),
    bulkPublish: vi.fn(),
  };
}

function makeEnqueuer(): PublishingQueueEnqueuer {
  return { enqueue: vi.fn().mockResolvedValue('job-1'), close: vi.fn() };
}

describe('GET /calendar/events', () => {
  it('returns events in range', async () => {
    const app = buildApp({ config: baseConfig, calendarService: makeCalendar(), authConfig });
    const res = await app.inject({
      method: 'GET',
      url: '/calendar/events?start=2026-07-01T00:00:00.000Z&end=2026-07-31T23:59:59.999Z',
      headers: { 'x-api-key': 'smoke-key' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { count: number }).count).toBe(1);
    await app.close();
  });

  it('returns 400 without start/end', async () => {
    const app = buildApp({ config: baseConfig, calendarService: makeCalendar(), authConfig });
    const res = await app.inject({
      method: 'GET',
      url: '/calendar/events',
      headers: { 'x-api-key': 'smoke-key' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /calendar/timeline', () => {
  it('returns chronological timeline', async () => {
    const calendar = makeCalendar();
    const app = buildApp({ config: baseConfig, calendarService: calendar, authConfig });
    const res = await app.inject({
      method: 'GET',
      url: '/calendar/timeline',
      headers: { 'x-api-key': 'smoke-key' },
    });
    expect(res.statusCode).toBe(200);
    expect(calendar.listTimeline).toHaveBeenCalled();
    await app.close();
  });
});

describe('POST /composer/schedule', () => {
  it('schedules jobs and returns 202', async () => {
    const composer = makeComposer();
    const app = buildApp({
      config: baseConfig,
      composerService: composer,
      publishingEnqueuer: makeEnqueuer(),
      authConfig,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/schedule',
      headers: { 'x-api-key': 'smoke-key' },
      payload: {
        assetId: 'asset-1',
        publisherIds: ['wordpress', 'ghost'],
        scheduledFor: future,
      },
    });
    expect(res.statusCode).toBe(202);
    expect(composer.schedule).toHaveBeenCalled();
    await app.close();
  });

  it('returns 400 when scheduledFor missing', async () => {
    const app = buildApp({
      config: baseConfig,
      composerService: makeComposer(),
      publishingEnqueuer: makeEnqueuer(),
      authConfig,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/schedule',
      headers: { 'x-api-key': 'smoke-key' },
      payload: { assetId: 'asset-1', publisherIds: ['wordpress'] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
