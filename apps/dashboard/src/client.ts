import { clampDashboardLimit, DEFAULT_DASHBOARD_LIST_LIMIT } from './limits.js';
import type {
  ActivityEvent,
  ActivityListResult,
  AssetDetail,
  AssetListFilters,
  AssetListResult,
  CalendarEventsResult,
  CalendarTimelineResult,
  ComposerAssetDetail,
  ComposerAssetListResult,
  ComposerBulkPublishResult,
  ComposerPublishResult,
  ComposerValidateResult,
  DashboardHealthData,
  DashboardMetricsData,
  DashboardQueueData,
  DashboardRecentData,
  DashboardSummaryData,
  JobDetail,
  JobListFilters,
  JobListResult,
  NotificationListResult,
  ProviderConfigDetail,
  ProviderConfigListResult,
  ProviderConfigValidationResult,
  PublisherDetail,
  PublisherHealthResult,
  PublisherListItem,
  QueueActionResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Interface — allows injection of mock clients in tests
// ---------------------------------------------------------------------------

export interface DashboardApiClient {
  fetchHealth(): Promise<DashboardHealthData | null>;
  fetchSummary(): Promise<DashboardSummaryData | null>;
  fetchRecent(limit?: number): Promise<DashboardRecentData | null>;
  fetchMetrics(): Promise<DashboardMetricsData | null>;
  /** GET /queue/status — requires auth when PCME_AUTH_ENABLED=true. */
  fetchQueueStatus(): Promise<DashboardQueueData | null>;
  /** Sprint 36 queue operations — require auth when PCME_AUTH_ENABLED=true. */
  pauseQueue(): Promise<QueueActionResult>;
  resumeQueue(): Promise<QueueActionResult>;
  drainQueue(): Promise<QueueActionResult>;
  retryJob(jobId: string): Promise<QueueActionResult>;
  removeJob(jobId: string): Promise<QueueActionResult>;
  /** Sprint 37 publisher management — read-only. */
  fetchPublishers(): Promise<PublisherListItem[] | null>;
  fetchPublisherDetail(id: string): Promise<PublisherDetail | null>;
  fetchPublisherHealth(id: string): Promise<PublisherHealthResult | null>;
  /** Sprint 38 publishing jobs — require auth when PCME_AUTH_ENABLED=true. */
  fetchJobs(filters?: JobListFilters): Promise<JobListResult | null>;
  fetchJob(id: string): Promise<JobDetail | null>;
  /** Sprint 39 asset library — read-only. */
  fetchAssets(filters?: AssetListFilters): Promise<AssetListResult | null>;
  fetchAsset(id: string, projectId?: string): Promise<AssetDetail | null>;
  /** Sprint 40 content composer — read-only + validation. */
  fetchComposerAssets(projectId?: string, limit?: number): Promise<ComposerAssetListResult | null>;
  fetchComposerAsset(id: string, projectId?: string): Promise<ComposerAssetDetail | null>;
  validateComposer(
    assetId: string,
    publisherId: string,
    projectId?: string,
  ): Promise<ComposerValidateResult | null>;
  publishComposer(assetId: string, publisherIds: string[]): Promise<ComposerPublishResult | null>;
  bulkPublishComposer(
    assetIds: string[],
    publisherIds: string[],
  ): Promise<ComposerBulkPublishResult | null>;
  fetchCalendarEvents(
    start: string,
    end: string,
    filters?: { publisher?: string; status?: string },
  ): Promise<CalendarEventsResult | null>;
  fetchCalendarTimeline(filters?: {
    start?: string;
    end?: string;
    publisher?: string;
    limit?: number;
  }): Promise<CalendarTimelineResult | null>;
  /** Sprint 44 provider configuration management. */
  fetchProviderConfigs(): Promise<ProviderConfigListResult | null>;
  fetchProviderConfig(id: string): Promise<ProviderConfigDetail | null>;
  validateProviderConfig(
    id: string,
    values: Record<string, string>,
  ): Promise<ProviderConfigValidationResult | null>;
  updateProviderConfig(
    id: string,
    values: Record<string, string>,
  ): Promise<{
    ok: boolean;
    status: number;
    detail: ProviderConfigDetail | null;
    validation: ProviderConfigValidationResult | null;
  }>;
  /** Sprint 46 activity / audit log. */
  fetchActivity(filters?: {
    type?: string;
    actor?: string;
    target?: string;
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<ActivityListResult | null>;
  fetchActivityEvent(id: string): Promise<ActivityEvent | null>;
  /** Sprint 47 notification center. */
  fetchNotifications(filters?: {
    unread?: boolean;
    severity?: string;
    limit?: number;
  }): Promise<NotificationListResult | null>;
  markNotificationRead(id: string): Promise<{ ok: boolean; status: number }>;
  markAllNotificationsRead(): Promise<{ ok: boolean; status: number; marked?: number }>;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, apiKey?: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function postJson<T>(url: string, body: unknown, apiKey?: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (apiKey) headers['x-api-key'] = apiKey;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function putJson<T>(
  url: string,
  body: unknown,
  apiKey?: string,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (apiKey) headers['x-api-key'] = apiKey;
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      try {
        const errBody = (await res.json()) as T;
        return { ok: false, status: res.status, data: errBody };
      } catch {
        return { ok: false, status: res.status, data: null };
      }
    }
    return { ok: true, status: res.status, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function apiAction(
  url: string,
  method: 'POST' | 'DELETE',
  apiKey?: string,
): Promise<QueueActionResult> {
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;

    const res = await fetch(url, {
      method,
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // non-JSON body
    }

    if (res.status === 401) {
      message = 'Unauthorized — configure DASHBOARD_API_KEY to match a value in PCME_API_KEYS';
    } else if (res.status === 503) {
      message = message || 'Queue management unavailable (no Redis configured in API)';
    }

    return { ok: res.ok, status: res.status, message };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export function createDashboardApiClient(baseUrl: string, apiKey?: string): DashboardApiClient {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    fetchHealth: () => fetchJson<DashboardHealthData>(`${base}/dashboard/health`),
    fetchSummary: () => fetchJson<DashboardSummaryData>(`${base}/dashboard/summary`),
    fetchRecent: (limit = 10) =>
      fetchJson<DashboardRecentData>(`${base}/dashboard/recent?limit=${limit}`),
    fetchMetrics: () => fetchJson<DashboardMetricsData>(`${base}/metrics`),
    fetchQueueStatus: () => fetchJson<DashboardQueueData>(`${base}/queue/status`, apiKey),
    pauseQueue: () => apiAction(`${base}/queue/pause`, 'POST', apiKey),
    resumeQueue: () => apiAction(`${base}/queue/resume`, 'POST', apiKey),
    drainQueue: () => apiAction(`${base}/queue/drain`, 'POST', apiKey),
    retryJob: (jobId: string) =>
      apiAction(`${base}/queue/jobs/${encodeURIComponent(jobId)}/retry`, 'POST', apiKey),
    removeJob: (jobId: string) =>
      apiAction(`${base}/queue/jobs/${encodeURIComponent(jobId)}`, 'DELETE', apiKey),
    fetchPublishers: async () => {
      const data = await fetchJson<{ publishers: PublisherListItem[] }>(`${base}/publishers`);
      return data?.publishers ?? null;
    },
    fetchPublisherDetail: (id: string) =>
      fetchJson<PublisherDetail>(`${base}/publishers/${encodeURIComponent(id)}`),
    fetchPublisherHealth: (id: string) =>
      fetchJson<PublisherHealthResult>(`${base}/publishers/${encodeURIComponent(id)}/health`),
    fetchJobs: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.publisher) params.set('publisher', filters.publisher);
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.assetId) params.set('assetId', filters.assetId);
      if (filters.limit !== undefined) params.set('limit', String(filters.limit));
      if (filters.offset !== undefined) params.set('offset', String(filters.offset));
      const qs = params.toString();
      return fetchJson<JobListResult>(`${base}/jobs${qs ? `?${qs}` : ''}`, apiKey);
    },
    fetchJob: (id: string) =>
      fetchJson<JobDetail>(`${base}/jobs/${encodeURIComponent(id)}`, apiKey),
    fetchAssets: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.status) params.set('status', filters.status);
      if (filters.mimeType) params.set('mimeType', filters.mimeType);
      if (filters.limit !== undefined) params.set('limit', String(filters.limit));
      if (filters.offset !== undefined) params.set('offset', String(filters.offset));
      const qs = params.toString();
      return fetchJson<AssetListResult>(`${base}/assets${qs ? `?${qs}` : ''}`);
    },
    fetchAsset: (id: string, projectId?: string) => {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      const qs = params.toString();
      return fetchJson<AssetDetail>(
        `${base}/assets/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
      );
    },
    fetchComposerAssets: (projectId?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      params.set('limit', String(clampDashboardLimit(limit ?? DEFAULT_DASHBOARD_LIST_LIMIT)));
      const qs = params.toString();
      return fetchJson<ComposerAssetListResult>(`${base}/composer/assets?${qs}`);
    },
    fetchComposerAsset: (id: string, projectId?: string) => {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      const qs = params.toString();
      return fetchJson<ComposerAssetDetail>(
        `${base}/composer/assets/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
      );
    },
    validateComposer: (assetId, publisherId, projectId) =>
      postJson<ComposerValidateResult>(
        `${base}/composer/validate`,
        { assetId, publisherId, projectId },
        apiKey,
      ),
    publishComposer: (assetId, publisherIds) =>
      postJson<ComposerPublishResult>(
        `${base}/composer/publish`,
        { assetId, publisherIds },
        apiKey,
      ),
    bulkPublishComposer: (assetIds, publisherIds) =>
      postJson<ComposerBulkPublishResult>(
        `${base}/composer/bulk-publish`,
        { assetIds, publisherIds },
        apiKey,
      ),
    fetchCalendarEvents: (start, end, filters = {}) => {
      const params = new URLSearchParams({ start, end });
      if (filters.publisher) params.set('publisher', filters.publisher);
      if (filters.status) params.set('status', filters.status);
      return fetchJson<CalendarEventsResult>(`${base}/calendar/events?${params}`, apiKey);
    },
    fetchCalendarTimeline: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.start) params.set('start', filters.start);
      if (filters.end) params.set('end', filters.end);
      if (filters.publisher) params.set('publisher', filters.publisher);
      if (filters.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      return fetchJson<CalendarTimelineResult>(
        `${base}/calendar/timeline${qs ? `?${qs}` : ''}`,
        apiKey,
      );
    },
    fetchProviderConfigs: () =>
      fetchJson<ProviderConfigListResult>(`${base}/providers/config`, apiKey),
    fetchProviderConfig: (id: string) =>
      fetchJson<ProviderConfigDetail>(`${base}/providers/config/${encodeURIComponent(id)}`, apiKey),
    validateProviderConfig: (id, values) =>
      postJson<ProviderConfigValidationResult>(
        `${base}/providers/config/${encodeURIComponent(id)}/validate`,
        values,
        apiKey,
      ),
    updateProviderConfig: async (id, values) => {
      const result = await putJson<ProviderConfigDetail | ProviderConfigValidationResult>(
        `${base}/providers/config/${encodeURIComponent(id)}`,
        values,
        apiKey,
      );
      if (result.ok && result.data && 'id' in result.data) {
        return { ok: true, status: result.status, detail: result.data, validation: null };
      }
      const validation = result.data && 'valid' in result.data ? result.data : null;
      return { ok: false, status: result.status, detail: null, validation };
    },
    fetchActivity: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.actor) params.set('actor', filters.actor);
      if (filters.target) params.set('target', filters.target);
      if (filters.start) params.set('start', filters.start);
      if (filters.end) params.set('end', filters.end);
      if (filters.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      return fetchJson<ActivityListResult>(`${base}/activity${qs ? `?${qs}` : ''}`, apiKey);
    },
    fetchActivityEvent: (id: string) =>
      fetchJson<ActivityEvent>(`${base}/activity/${encodeURIComponent(id)}`, apiKey),
    fetchNotifications: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.unread === true) params.set('unread', 'true');
      if (filters.unread === false) params.set('unread', 'false');
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      return fetchJson<NotificationListResult>(
        `${base}/notifications${qs ? `?${qs}` : ''}`,
        apiKey,
      );
    },
    markNotificationRead: async (id: string) => {
      try {
        const headers: Record<string, string> = { accept: 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const res = await fetch(`${base}/notifications/${encodeURIComponent(id)}/read`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(10_000),
        });
        return { ok: res.ok, status: res.status };
      } catch {
        return { ok: false, status: 0 };
      }
    },
    markAllNotificationsRead: async () => {
      try {
        const headers: Record<string, string> = { accept: 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const res = await fetch(`${base}/notifications/read-all`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(10_000),
        });
        let marked: number | undefined;
        if (res.ok) {
          const body = (await res.json()) as { marked?: number };
          marked = body.marked;
        }
        return { ok: res.ok, status: res.status, marked };
      } catch {
        return { ok: false, status: 0 };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Fetch all endpoints concurrently; collect error messages
// ---------------------------------------------------------------------------

export async function fetchAllDashboardData(client: DashboardApiClient): Promise<{
  health: DashboardHealthData | null;
  summary: DashboardSummaryData | null;
  recent: DashboardRecentData | null;
  metrics: DashboardMetricsData | null;
  queueStatus: DashboardQueueData | null;
  errors: string[];
}> {
  const [health, summary, recent, metrics, queueStatus] = await Promise.all([
    client.fetchHealth(),
    client.fetchSummary(),
    client.fetchRecent(10),
    client.fetchMetrics(),
    client.fetchQueueStatus(),
  ]);

  const errors: string[] = [];
  if (!health) errors.push('Could not reach /dashboard/health');
  if (!summary) errors.push('Could not reach /dashboard/summary');
  if (!recent) errors.push('Could not reach /dashboard/recent');
  if (!metrics) errors.push('Could not reach /metrics');

  return { health, summary, recent, metrics, queueStatus, errors };
}

export async function fetchAllPublishersData(client: DashboardApiClient): Promise<{
  publishers: PublisherListItem[];
  details: Record<string, PublisherDetail | null>;
  errors: string[];
}> {
  const publishers = await client.fetchPublishers();
  const errors: string[] = [];

  if (!publishers) {
    errors.push('Could not reach /publishers');
    return { publishers: [], details: {}, errors };
  }

  const detailsEntries = await Promise.all(
    publishers.map(async (p) => [p.id, await client.fetchPublisherDetail(p.id)] as const),
  );
  const details = Object.fromEntries(detailsEntries);

  return { publishers, details, errors };
}
