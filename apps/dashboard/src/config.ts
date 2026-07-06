export type DashboardConfig = {
  /** TCP port the dashboard server listens on. Default: 3002 */
  port: number;
  /** Bind address. Default: 0.0.0.0 */
  host: string;
  /**
   * Base URL of the PC Media Engine API.
   * Set DASHBOARD_API_BASE_URL to point at the running API instance.
   * Default: http://localhost:3001
   */
  apiBaseUrl: string;
  /** Pino log level. Default: info */
  logLevel: string;
  /** Package version. */
  version: string;
  /**
   * Optional API key sent as X-API-Key header when calling authenticated endpoints
   * (e.g. GET /queue/status). Required in production when PCME_AUTH_ENABLED=true.
   * Sprint 32+.
   */
  apiKey: string | undefined;
};

export function loadDashboardConfig(): DashboardConfig {
  return {
    port: Number(process.env['DASHBOARD_PORT'] ?? 3002),
    host: process.env['DASHBOARD_HOST'] ?? '0.0.0.0',
    apiBaseUrl: (process.env['DASHBOARD_API_BASE_URL'] ?? 'http://localhost:3001').replace(
      /\/+$/,
      '',
    ),
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    version: process.env['npm_package_version'] ?? '0.0.0',
    apiKey: process.env['DASHBOARD_API_KEY'] ?? undefined,
  };
}
