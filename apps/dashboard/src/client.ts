import type { DashboardHealthData, DashboardRecentData, DashboardSummaryData } from './types.js';

// ---------------------------------------------------------------------------
// Interface — allows injection of mock clients in tests
// ---------------------------------------------------------------------------

export interface DashboardApiClient {
  fetchHealth(): Promise<DashboardHealthData | null>;
  fetchSummary(): Promise<DashboardSummaryData | null>;
  fetchRecent(limit?: number): Promise<DashboardRecentData | null>;
}

// ---------------------------------------------------------------------------
// HTTP implementation using native fetch (Node >= 18)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function createDashboardApiClient(baseUrl: string): DashboardApiClient {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    fetchHealth: () => fetchJson<DashboardHealthData>(`${base}/dashboard/health`),
    fetchSummary: () => fetchJson<DashboardSummaryData>(`${base}/dashboard/summary`),
    fetchRecent: (limit = 10) =>
      fetchJson<DashboardRecentData>(`${base}/dashboard/recent?limit=${limit}`),
  };
}

// ---------------------------------------------------------------------------
// Fetch all three endpoints concurrently; collect error messages
// ---------------------------------------------------------------------------

export async function fetchAllDashboardData(
  client: DashboardApiClient,
): Promise<{
  health: DashboardHealthData | null;
  summary: DashboardSummaryData | null;
  recent: DashboardRecentData | null;
  errors: string[];
}> {
  const [health, summary, recent] = await Promise.all([
    client.fetchHealth(),
    client.fetchSummary(),
    client.fetchRecent(10),
  ]);

  const errors: string[] = [];
  if (!health) errors.push('Could not reach /dashboard/health');
  if (!summary) errors.push('Could not reach /dashboard/summary');
  if (!recent) errors.push('Could not reach /dashboard/recent');

  return { health, summary, recent, errors };
}
