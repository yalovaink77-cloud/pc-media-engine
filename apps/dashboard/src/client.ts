import type {
  DashboardHealthData,
  DashboardMetricsData,
  DashboardQueueData,
  DashboardRecentData,
  DashboardSummaryData,
} from './types.js';

// ---------------------------------------------------------------------------
// Interface — allows injection of mock clients in tests
// ---------------------------------------------------------------------------

export interface DashboardApiClient {
  fetchHealth(): Promise<DashboardHealthData | null>;
  fetchSummary(): Promise<DashboardSummaryData | null>;
  fetchRecent(limit?: number): Promise<DashboardRecentData | null>;
  fetchMetrics(): Promise<DashboardMetricsData | null>;
  /** Sprint 32: GET /queue/status — requires auth when PCME_AUTH_ENABLED=true. */
  fetchQueueStatus(): Promise<DashboardQueueData | null>;
}

// ---------------------------------------------------------------------------
// HTTP implementation using native fetch (Node >= 18)
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

export function createDashboardApiClient(baseUrl: string, apiKey?: string): DashboardApiClient {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    fetchHealth: () => fetchJson<DashboardHealthData>(`${base}/dashboard/health`),
    fetchSummary: () => fetchJson<DashboardSummaryData>(`${base}/dashboard/summary`),
    fetchRecent: (limit = 10) =>
      fetchJson<DashboardRecentData>(`${base}/dashboard/recent?limit=${limit}`),
    fetchMetrics: () => fetchJson<DashboardMetricsData>(`${base}/metrics`),
    // Queue status may require auth — pass apiKey when configured.
    fetchQueueStatus: () => fetchJson<DashboardQueueData>(`${base}/queue/status`, apiKey),
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
  // Queue status is best-effort — no error when unavailable.

  return { health, summary, recent, metrics, queueStatus, errors };
}
