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

  // ---------------------------------------------------------------------------
  // Storage (Sprint 7+)
  // ---------------------------------------------------------------------------

  /**
   * Absolute or relative path to the local storage root directory.
   * Resolved to absolute on startup. Default: ./storage/local
   * Production: set STORAGE_LOCAL_ROOT to a persistent volume path.
   */
  storageLocalRoot: string;

  // ---------------------------------------------------------------------------
  // Default project context (Sprint 9 — replaces auth until Sprint N)
  // ---------------------------------------------------------------------------

  /**
   * Organization ID to use when no per-request context is available.
   * Set PCME_DEFAULT_ORG_ID to the value printed by `pnpm db:seed`.
   * Leave empty to disable the upload route until configured.
   */
  defaultOrgId: string;

  /**
   * Project ID to use when no per-request context is available.
   * Set PCME_DEFAULT_PROJECT_ID to the value printed by `pnpm db:seed`.
   */
  defaultProjectId: string;

  /**
   * Project slug used to build deterministic storage keys.
   * Default: piercingconnect (the seeded development project).
   */
  defaultProjectSlug: string;
};

export function loadConfig(): Config {
  return {
    port: Number(process.env['API_PORT'] ?? 3001),
    host: process.env['API_HOST'] ?? '0.0.0.0',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    env: process.env['NODE_ENV'] ?? 'development',
    version: process.env['npm_package_version'] ?? '0.0.0',
    databaseUrl: process.env['DATABASE_URL'],
    storageLocalRoot: process.env['STORAGE_LOCAL_ROOT'] ?? './storage/local',
    defaultOrgId: process.env['PCME_DEFAULT_ORG_ID'] ?? '',
    defaultProjectId: process.env['PCME_DEFAULT_PROJECT_ID'] ?? '',
    defaultProjectSlug: process.env['PCME_DEFAULT_PROJECT_SLUG'] ?? 'piercingconnect',
  };
}
