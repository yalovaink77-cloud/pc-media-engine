/**
 * Response shapes that mirror the Sprint 27 dashboard API endpoints.
 * Kept local to avoid a hard dependency on @pcme/api at runtime.
 */

export type DashboardHealthData = {
  status: 'ok';
  database: 'ok' | 'unavailable' | 'skipped';
  publishing: {
    publisherDriver: string;
    queueEnabled: boolean;
    retryConfig: { maxRetries: number; backoffMs: number };
  };
  version: string;
  env: string;
};

export type PublisherCount = {
  publisher: string;
  count: number;
};

export type DashboardSummaryData = {
  totalPublished: number;
  totalDrafts: number;
  totalFailed: number;
  latestPublishedAt: string | null;
  publishers: PublisherCount[];
  duplicateDetectionEnabled: boolean;
  schedulerEnabled: boolean;
  retryEnabled: boolean;
  aiProvider: string;
  publisherDriver: string;
};

export type RecentItem = {
  id: string;
  projectId: string;
  assetId: string;
  publisher: string;
  externalId: string;
  url: string;
  status: string;
  publishedAt: string;
  createdAt: string;
};

export type DashboardRecentData = {
  items: RecentItem[];
  count: number;
};

/** All data fetched for one page render. */
export type DashboardPageData = {
  health: DashboardHealthData | null;
  summary: DashboardSummaryData | null;
  recent: DashboardRecentData | null;
  /** ISO string; set at the time the server handles the request. */
  fetchedAt: string;
  /** One or more user-visible error messages when any fetch failed. */
  errors: string[];
};
