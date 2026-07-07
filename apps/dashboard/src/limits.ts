/** Defensive list limits for dashboard API fetches — Sprint 49. */

/** Default page size for composer and bulk-publish asset pickers. */
export const DEFAULT_DASHBOARD_LIST_LIMIT = 50;

/** Hard maximum for any dashboard list fetch. */
export const MAX_DASHBOARD_LIST_LIMIT = 200;

/** Clamp a dashboard-side limit to safe bounds. */
export function clampDashboardLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit) || limit < 1) {
    return DEFAULT_DASHBOARD_LIST_LIMIT;
  }
  return Math.min(limit, MAX_DASHBOARD_LIST_LIMIT);
}
