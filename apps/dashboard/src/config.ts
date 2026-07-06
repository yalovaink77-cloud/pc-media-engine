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
  };
}
