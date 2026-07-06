/**
 * Worker startup validation and diagnostics (Sprint 30 — Beta Hardening).
 */

import type { WorkerConfig } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkerStartupDiagnostic = {
  errors: string[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateWorkerConfig(config: WorkerConfig): WorkerStartupDiagnostic {
  const errors: string[] = [];
  const warnings: string[] = [];

  // REDIS_URL — mandatory; BullMQ cannot operate without it.
  if (!config.redisUrl) {
    errors.push('REDIS_URL is required for the worker (BullMQ needs Redis)');
  } else {
    try {
      const u = new URL(config.redisUrl);
      if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') {
        errors.push(`REDIS_URL must use the redis:// or rediss:// scheme (got: ${u.protocol})`);
      }
    } catch {
      errors.push(`REDIS_URL is not a valid URL: "${config.redisUrl}"`);
    }
  }

  // DATABASE_URL — optional, but many features degrade without it.
  if (!config.databaseUrl) {
    warnings.push(
      'DATABASE_URL is not set — publishing history, duplicate detection and retry persistence are disabled',
    );
  }

  // STORAGE_LOCAL_ROOT — required for thumbnail generation and media access.
  if (!config.storageLocalRoot) {
    warnings.push(
      'STORAGE_LOCAL_ROOT is not set — thumbnail generation and media file access may fail',
    );
  }

  // Concurrency sanity check.
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1) {
    errors.push(`WORKER_CONCURRENCY must be a positive integer (got: ${config.concurrency})`);
  }

  // Retry config sanity check.
  if (config.publishingMaxRetries < 0) {
    errors.push(`PCME_PUBLISHING_MAX_RETRIES must be >= 0 (got: ${config.publishingMaxRetries})`);
  }
  if (config.publishingBackoffMs < 0) {
    errors.push(`PCME_PUBLISHING_BACKOFF_MS must be >= 0 (got: ${config.publishingBackoffMs})`);
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Startup summary
// ---------------------------------------------------------------------------

export function logWorkerStartupSummary(config: WorkerConfig, startedAt: string): void {
  const lines = [
    `[worker] ─── PC Media Engine Worker ───────────────────────────`,
    `[worker]   started_at       : ${startedAt}`,
    `[worker]   redis            : ${config.redisUrl}`,
    `[worker]   database         : ${config.databaseUrl || 'DISABLED'}`,
    `[worker]   storage          : ${config.storageLocalRoot || 'DISABLED'}`,
    `[worker]   concurrency      : ${config.concurrency}`,
    `[worker]   publisher        : ${config.publisherDriver}`,
    `[worker]   auto_enqueue_pub : ${config.autoEnqueuePublishing}`,
    `[worker]   retry            : max=${config.publishingMaxRetries} backoff=${config.publishingBackoffMs}ms`,
    `[worker] ─────────────────────────────────────────────────────────`,
  ];
  lines.forEach((l) => console.log(l));
}

// ---------------------------------------------------------------------------
// Fatal guard
// ---------------------------------------------------------------------------

export function assertNoFatalWorkerErrors(
  diagnostic: WorkerStartupDiagnostic,
  prefix = '[worker]',
): void {
  if (diagnostic.errors.length > 0) {
    console.error(`${prefix} ✗ Fatal configuration error(s):`);
    for (const e of diagnostic.errors) {
      console.error(`${prefix}   • ${e}`);
    }
    throw new Error(
      `Worker startup aborted — ${diagnostic.errors.length} configuration error(s) found`,
    );
  }
  for (const w of diagnostic.warnings) {
    console.warn(`${prefix} ⚠  ${w}`);
  }
}
