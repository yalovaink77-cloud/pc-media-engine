import type {
  DashboardHealthData,
  DashboardMetricsData,
  DashboardQueueData,
  DashboardRecentData,
  DashboardSummaryData,
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
