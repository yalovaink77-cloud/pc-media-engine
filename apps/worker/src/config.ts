// ---------------------------------------------------------------------------
// Worker configuration
// ---------------------------------------------------------------------------

import { parseEnvFlag } from './env-flags.js';
import { type PublisherDriver, resolvePublisherDriver } from './publishing/publisher-driver.js';

export type WorkerConfig = {
  redisUrl: string;
  databaseUrl: string;
  storageLocalRoot: string;
  concurrency: number;
  logLevel: string;
  publisherDriver: PublisherDriver;
  /** When true, enqueue publishing after thumbnail success. Default: false. */
  autoEnqueuePublishing: boolean;
};

/**
 * Parse a redis:// URL into the host/port object BullMQ expects.
 * Falls back gracefully when port is absent from the URL.
 */
export function parseRedisConnection(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
  };
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    databaseUrl: process.env['DATABASE_URL'] ?? '',
    storageLocalRoot: process.env['STORAGE_LOCAL_ROOT'] ?? '',
    concurrency: parseInt(process.env['WORKER_CONCURRENCY'] ?? '5', 10),
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    publisherDriver: resolvePublisherDriver(process.env),
    autoEnqueuePublishing: parseEnvFlag(process.env['PCME_AUTO_ENQUEUE_PUBLISHING']),
  };
}
