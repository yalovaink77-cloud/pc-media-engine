/**
 * API configuration — loaded from environment variables.
 *
 * Use loadConfig() at application startup after dotenv has been applied.
 * Never import process.env directly inside route/plugin files.
 */
export type Config = {
  /** TCP port the server listens on. Default: 3001 */
  port: number;
  /** Bind address. Use 0.0.0.0 in containers, 127.0.0.1 for local-only. */
  host: string;
  /** Pino log level. Default: info */
  logLevel: string;
  /** NODE_ENV value. Default: development */
  env: string;
  /** Package version from npm_package_version or fallback. */
  version: string;
  /**
   * PostgreSQL connection string.
   * If undefined the health endpoint skips the database check.
   */
  databaseUrl: string | undefined;
};

export function loadConfig(): Config {
  return {
    port: Number(process.env['API_PORT'] ?? 3001),
    host: process.env['API_HOST'] ?? '0.0.0.0',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    env: process.env['NODE_ENV'] ?? 'development',
    version: process.env['npm_package_version'] ?? '0.0.0',
    databaseUrl: process.env['DATABASE_URL'],
  };
}
