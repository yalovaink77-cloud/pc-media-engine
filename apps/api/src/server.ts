import { resolve } from 'node:path';

import {
  getPrismaClient,
  MediaAssetRepository,
  MetadataRecordRepository,
  ProcessingArtifactRepository,
  ProcessingJobRepository,
  PublishedContentRepository,
} from '@pcme/database';
import { LocalStorageProvider } from '@pcme/media';

import { buildApp } from './app.js';
import { createAssetLibraryService } from './assets/asset-library-service.js';
import { createAuditService } from './audit/audit-service.js';
import { systemActor } from './audit/helpers.js';
import { createInMemoryAuditRepository } from './audit/in-memory-repository.js';
import { loadAuthConfig, validateAuthConfig } from './auth/index.js';
import { createCalendarService } from './calendar/calendar-service.js';
import { createContentComposerService } from './composer/content-composer-service.js';
import type { Config } from './config.js';
import { createCachedDatabaseCheck } from './database-check-cache.js';
import { MetricsService } from './metrics.js';
import { createInMemoryNotificationRepository } from './notifications/in-memory-repository.js';
import { createNotificationService } from './notifications/notification-service.js';
import { createNotifyingAuditRepository } from './notifications/notifying-audit-repository.js';
import { ProviderConfigStore } from './providers/config-store.js';
import { createProviderConfigService } from './providers/provider-config-service.js';
import {
  createDefaultPublisherRegistry,
  createPublisherService,
} from './publishers/publisher-service.js';
import { createBullMqQueueService } from './queue/bullmq-queue-service.js';
import { buildPublishingEnqueuer } from './queue/publishing-enqueue.js';
import { buildProcessingEnqueuer, parseRedisConnection } from './queue/redis-enqueue.js';
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

  const checkDatabase = config.databaseUrl
    ? createCachedDatabaseCheck(buildDatabaseCheck(config.databaseUrl))
    : undefined;

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

  const authConfig = loadAuthConfig();
  const isProduction = config.env === 'production';
  const authDiag = validateAuthConfig(authConfig, { production: isProduction });
  for (const w of authDiag.warnings) console.warn(`[api/auth] ⚠  ${w}`);
  if (isProduction) {
    assertNoFatalErrors({ errors: authDiag.errors, warnings: [] }, '[api/auth]');
  } else {
    for (const e of authDiag.errors) console.error(`[api/auth] ✗  ${e}`);
    if (authDiag.errors.length > 0) {
      console.error(
        '[api/auth] Auth errors detected — authentication layer may not function correctly',
      );
    }
  }
  console.log(
    `[api/auth] enabled=${authConfig.enabled} jwt=${authConfig.jwtEnabled} apiKey=${authConfig.apiKeyEnabled}`,
  );

  const publishedContentRepo = config.databaseUrl ? new PublishedContentRepository() : undefined;
  const metricsService = new MetricsService(startedAt);

  // Sprint 32: queue management service — only when Redis is configured.
  const queueService = config.redisUrl
    ? createBullMqQueueService('publishing', parseRedisConnection(config.redisUrl))
    : undefined;
  if (!queueService) {
    console.warn('[api/queue] Queue management disabled — set REDIS_URL to enable');
  }

  const queueMetricsProvider = queueService
    ? {
        async getQueueMetrics() {
          const status = await queueService.getStatus();
          return {
            waiting: status.waiting,
            active: status.active,
            completed: status.completed,
            failed: status.failed,
          };
        },
      }
    : undefined;

  const publisherRegistry = createDefaultPublisherRegistry();
  const providerConfigStore = new ProviderConfigStore({ baseEnv: process.env });
  const getProviderEnv = () => providerConfigStore.getMergedEnv();

  const publisherService = createPublisherService({
    registry: publisherRegistry,
    getEnv: getProviderEnv,
  });
  const providerConfigService = createProviderConfigService({
    registry: publisherRegistry,
    configStore: providerConfigStore,
  });
  console.log(
    `[api/publishers] Registered providers: ${publisherService
      .listPublishers()
      .map((p) => p.id)
      .join(', ')}`,
  );

  const assetLibrary =
    assetRepository && config.databaseUrl
      ? createAssetLibraryService({
          listAssets: (projectId) => assetRepository.listByProject(projectId),
          findAsset: (projectId, assetId) => assetRepository.findById(projectId, assetId),
          findProcessingJobs: (projectId, assetId) =>
            (jobScheduler ?? new ProcessingJobRepository()).findByAsset(projectId, assetId),
          listArtifacts: (projectId, assetId) =>
            new ProcessingArtifactRepository().listByAsset(projectId, assetId),
          findDimensions: (projectId, assetId) =>
            new MetadataRecordRepository().findByAssetNamespace(projectId, assetId, 'dimensions'),
          findAllMetadata: (projectId, assetId) =>
            new MetadataRecordRepository().findByAsset(projectId, assetId),
          findPublished: (projectId, assetId) =>
            publishedContentRepo?.findByAsset(projectId, assetId) ?? Promise.resolve([]),
          storageProvider,
        })
      : undefined;

  if (!assetLibrary) {
    console.warn('[api/assets] Asset library disabled — set DATABASE_URL and default project');
  }

  const composerService =
    assetLibrary && publisherService
      ? createContentComposerService({
          assetLibrary,
          publisherService,
          findDuplicate: publishedContentRepo
            ? async (projectId, publisher, slug) => {
                const existing = await publishedContentRepo.findDuplicate(
                  projectId,
                  publisher,
                  slug,
                );
                return existing !== null;
              }
            : undefined,
          publishingEnqueuer: buildPublishingEnqueuer(config.redisUrl, config),
          storageProvider,
          defaultOrganizationId: config.defaultOrgId,
          env: process.env,
        })
      : undefined;

  if (!composerService) {
    console.warn(
      '[api/composer] Content composer disabled — requires asset library and publisher service',
    );
  }

  const publishingEnqueuer = buildPublishingEnqueuer(config.redisUrl, config);

  const calendarService = queueService
    ? createCalendarService({
        queueService,
        publishedContentRepo,
        publisherDriver: config.publisherDriver,
      })
    : undefined;

  const auditRepository = createInMemoryAuditRepository();
  const notificationService = createNotificationService({
    repository: createInMemoryNotificationRepository(),
  });
  const auditService = createAuditService({
    repository: createNotifyingAuditRepository(auditRepository, notificationService),
  });

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
    queueMetricsProvider,
    startedAt,
    authConfig,
    queueService,
    publisherService,
    assetLibrary,
    composerService,
    publishingEnqueuer,
    calendarService,
    providerConfigService,
    auditService,
    notificationService,
  });

  auditService.record({
    type: 'system.startup',
    severity: 'info',
    actor: systemActor(),
    metadata: {
      version: config.version,
      env: config.env,
      port: config.port,
      startedAt,
    },
  });

  const gracefulShutdown = async (signal: string): Promise<void> => {
    auditService.record({
      type: 'system.shutdown',
      severity: 'info',
      actor: systemActor(),
      metadata: { signal },
    });
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
    auditService.record({
      type: 'system.fatal_error',
      severity: 'critical',
      actor: systemActor(),
      metadata: { reason: 'uncaughtException', message: String(err) },
    });
    app.log.fatal({ err }, '[api] Uncaught exception — shutting down');
    void gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    auditService.record({
      type: 'system.fatal_error',
      severity: 'critical',
      actor: systemActor(),
      metadata: { reason: 'unhandledRejection', message: String(reason) },
    });
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
