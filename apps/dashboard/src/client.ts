import type {
  AssetDetail,
  AssetListFilters,
  AssetListResult,
  DashboardHealthData,
  DashboardMetricsData,
  DashboardQueueData,
  DashboardRecentData,
  DashboardSummaryData,
  JobDetail,
  JobListFilters,
  JobListResult,
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
