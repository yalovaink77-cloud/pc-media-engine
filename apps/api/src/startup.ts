/**
 * API startup validation and diagnostics (Sprint 30 — Beta Hardening).
 *
 * validateApiConfig() is called before the HTTP server binds.
 * Fatal errors cause an immediate non-zero exit; warnings are logged and startup proceeds.
 */

import type { Config } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StartupDiagnostic = {
  /** Fatal problems — server must NOT start. */
  errors: string[];
  /** Non-fatal advisories — server will start but with reduced functionality. */
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateApiConfig(config: Config): StartupDiagnostic {
  const errors: string[] = [];
  const warnings: string[] = [];

  // DATABASE_URL — required for history, duplicate detection, dashboard stats.
  if (!config.databaseUrl) {
    warnings.push(
      'DATABASE_URL is not set — publishing history, duplicate detection and dashboard stats are disabled',
    );
  } else if (
    !config.databaseUrl.startsWith('postgres://') &&
    !config.databaseUrl.startsWith('postgresql://')
  ) {
    errors.push(
      'DATABASE_URL must be a valid PostgreSQL connection string (postgres:// or postgresql://)',
    );
  }

  // REDIS_URL — required for BullMQ processing and publishing queues.
  if (!config.redisUrl) {
    warnings.push('REDIS_URL is not set — media processing and publishing queues are disabled');
  }

  // STORAGE_LOCAL_ROOT — required for file upload.
  if (!config.storageLocalRoot) {
    warnings.push('STORAGE_LOCAL_ROOT is not set — file upload route is disabled');
  }

  // Default project context — required for uploads.
  if (!config.defaultOrgId) {
    warnings.push('PCME_DEFAULT_ORG_ID is not set — file upload route is disabled');
  }
  if (!config.defaultProjectId) {
    warnings.push('PCME_DEFAULT_PROJECT_ID is not set — file upload route is disabled');
  }

  // Sanity: port must be a valid TCP port number.
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push(`API_PORT must be an integer between 1 and 65535 (got: ${config.port})`);
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Startup summary
// ---------------------------------------------------------------------------

/**
 * Emit a structured human-readable startup summary to stdout.
 * Safe to call before the Fastify logger is available.
 */
export function logApiStartupSummary(config: Config, startedAt: string): void {
  const lines = [
    `[api] ─── PC Media Engine API ───────────────────────────────`,
    `[api]   version          : ${config.version}`,
    `[api]   env              : ${config.env}`,
    `[api]   port             : ${config.port}`,
    `[api]   started_at       : ${startedAt}`,
    `[api]   database         : ${config.databaseUrl ? 'configured' : 'DISABLED'}`,
    `[api]   redis            : ${config.redisUrl ? 'configured' : 'DISABLED'}`,
    `[api]   storage          : ${config.storageLocalRoot || 'DISABLED'}`,
    `[api]   publisher        : ${config.publisherDriver ?? 'mock'}`,
    `[api]   ai_provider      : ${config.aiMetadataProvider ?? 'none'}`,
    `[api]   auto_enqueue     : processing=${config.autoEnqueueProcessing} publishing=${config.autoEnqueuePublishing ?? false}`,
    `[api]   retry            : max=${config.publishingMaxRetries ?? 3} backoff=${config.publishingBackoffMs ?? 5000}ms`,
    `[api] ─────────────────────────────────────────────────────────`,
  ];
  lines.forEach((l) => console.log(l));
}

// ---------------------------------------------------------------------------
// Fatal guard
// ---------------------------------------------------------------------------

/**
 * Throw if the diagnostic contains any fatal errors.
 * Call immediately after validateApiConfig().
 */
export function assertNoFatalErrors(diagnostic: StartupDiagnostic, prefix = '[api]'): void {
  if (diagnostic.errors.length > 0) {
    console.error(`${prefix} ✗ Fatal configuration error(s):`);
    for (const e of diagnostic.errors) {
      console.error(`${prefix}   • ${e}`);
    }
    throw new Error(`Startup aborted — ${diagnostic.errors.length} configuration error(s) found`);
  }
  for (const w of diagnostic.warnings) {
    console.warn(`${prefix} ⚠  ${w}`);
  }
}
