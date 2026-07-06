import { resolve } from 'node:path';

import {
  getPrismaClient,
  MediaAssetRepository,
  ProcessingJobRepository,
  PublishedContentRepository,
} from '@pcme/database';
import { LocalStorageProvider } from '@pcme/media';

import { buildApp } from './app.js';
import type { Config } from './config.js';
import { MetricsService } from './metrics.js';
import { buildProcessingEnqueuer } from './queue/redis-enqueue.js';
import type { DatabaseStatus } from './routes/health.js';
import { assertNoFatalErrors, logApiStartupSummary, validateApiConfig } from './startup.js';

/**
 * Build a live database health check function using Prisma.
 * Always resolves — never rejects — so it can never crash the health endpoint.
 */
function buildDatabaseCheck(_databaseUrl: string): () => Promise<DatabaseStatus> {
  return async (): Promise<DatabaseStatus> => {
    try {
      const client = getPrismaClient();
      await client.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'unavailable';
    }
  };
}

export async function startServer(config: Config): Promise<void> {
  const startedAt = new Date().toISOString();

  // Validate configuration before any I/O — fail fast on fatal errors.
  const diagnostic = validateApiConfig(config);
  assertNoFatalErrors(diagnostic);
  logApiStartupSummary(config, startedAt);

  const checkDatabase = config.databaseUrl ? buildDatabaseCheck(config.databaseUrl) : undefined;

  const assetRepository =
    config.defaultOrgId && config.defaultProjectId ? new MediaAssetRepository() : undefined;

  const storageProvider = config.storageLocalRoot
    ? new LocalStorageProvider({ rootDir: resolve(config.storageLocalRoot) })
    : undefined;

  if (!assetRepository || !storageProvider) {
    console.warn(
      '[api] Upload route disabled — set PCME_DEFAULT_ORG_ID, PCME_DEFAULT_PROJECT_ID, STORAGE_LOCAL_ROOT',
    );
  }

  // Sprint 10: wire a real processing job scheduler when upload is active.
  const jobScheduler =
    assetRepository && storageProvider ? new ProcessingJobRepository() : undefined;

  const processingEnqueuer = buildProcessingEnqueuer(config.redisUrl, config.autoEnqueueProcessing);

  const publishedContentRepo = config.databaseUrl ? new PublishedContentRepository() : undefined;
  const metricsService = new MetricsService();

  const app = buildApp({
    config,
    checkDatabase,
    assetRepository,
    storageProvider,
    jobScheduler,
    processingEnqueuer,
    publishedContentRepo,
    dashboardRepo: publishedContentRepo,
    metricsService,
    startedAt,
  });

  const gracefulShutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, '[api] Shutdown signal received — draining connections');
    try {
      await app.close();
      app.log.info('[api] Server closed cleanly');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, '[api] Error during shutdown');
      process.exit(1);
    }
  };

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '[api] Uncaught exception — shutting down');
    void gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    app.log.fatal({ reason }, '[api] Unhandled rejection — shutting down');
    void gracefulShutdown('unhandledRejection');
  });

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}
