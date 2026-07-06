import { randomUUID } from 'node:crypto';

import type { StorageProvider } from '@pcme/media';
import Fastify from 'fastify';

import type { AssetLibraryService } from './assets/types.js';
import type { AuthConfig } from './auth/index.js';
import { createAuthMiddleware } from './auth/middleware.js';
import type { CalendarService } from './calendar/types.js';
import type { ContentComposerService } from './composer/types.js';
import type { Config } from './config.js';
import type { MetricsService } from './metrics.js';
import type { JobScheduler } from './orchestration/processing.orchestrator.js';
import type { ProviderConfigService } from './providers/types.js';
import type { PublisherManagementService } from './publishers/types.js';
import type { ProcessingEnqueuer } from './queue/processing-enqueue.js';
import type { PublishingQueueEnqueuer } from './queue/publishing-enqueue.js';
import type { QueueService } from './queue/queue-service.js';
import { assetsRoutes } from './routes/assets.js';
import type { AuthRouteOptions } from './routes/auth.js';
import { authRoutes } from './routes/auth.js';
import { calendarRoutes } from './routes/calendar.js';
import { composerRoutes } from './routes/composer.js';
import type { DashboardDataProvider } from './routes/dashboard.js';
import { dashboardRoutes } from './routes/dashboard.js';
import type { DatabaseStatus } from './routes/health.js';
import { healthRoutes } from './routes/health.js';
import { jobsRoutes } from './routes/jobs.js';
import type { AssetCreator } from './routes/media.js';
import { mediaRoutes } from './routes/media.js';
import type { QueueMetricsProvider } from './routes/metrics.js';
import { metricsRoutes } from './routes/metrics.js';
import { providerConfigRoutes } from './routes/provider-config.js';
import { publishersRoutes } from './routes/publishers.js';
import type { PublishedContentFinder } from './routes/publishing.js';
import { publishingRoutes } from './routes/publishing.js';
import { queueRoutes } from './routes/queue.js';
import { rootRoutes } from './routes/root.js';
import { versionRoutes } from './routes/version.js';

export type AppOptions = {
  config: Config;
  /**
   * Injected database check.
   * - undefined → skip DB check (tests, no DATABASE_URL configured)
   * - function  → called on every /health request
   *
   * Production wiring passes buildDatabaseCheck(config.databaseUrl) in server.ts.
   */
  checkDatabase?: () => Promise<DatabaseStatus>;
  /**
   * Injected asset repository (Sprint 9+).
   * Undefined → /media route is not registered.
   * Pass a mock in tests; production creates a real MediaAssetRepository.
   */
  assetRepository?: AssetCreator;
  /**
   * Injected storage provider (Sprint 9+).
   * Undefined → /media route is not registered.
   * Pass a mock in tests; production creates a real LocalStorageProvider.
   */
  storageProvider?: StorageProvider;
  /**
   * Injected processing job scheduler (Sprint 10+).
   * Undefined → processingJobs array in response will be empty (backward compatible).
   * Pass a mock in tests; production creates a real ProcessingJobRepository.
   */
  jobScheduler?: JobScheduler;
  /**
   * Optional processing queue enqueuer (Sprint 21+).
   * Undefined → jobs remain pending until manually enqueued.
   */
  processingEnqueuer?: ProcessingEnqueuer;
  /**
   * Optional publishing history repository (Sprint 26+).
   * When provided, the /publishing/* routes serve live data.
   * When absent, history/detail endpoints return 503.
   */
  publishedContentRepo?: PublishedContentFinder;
  /**
   * Optional dashboard data provider (Sprint 27+).
   * Satisfies the DashboardDataProvider interface.
   * When absent, summary/recent endpoints return 503.
   * In production the same PublishedContentRepository instance fulfils both roles.
   */
  dashboardRepo?: DashboardDataProvider;
  /**
   * Optional in-process metrics accumulator (Sprint 29+).
   * When provided, upload events are tracked and GET /metrics returns live data.
   */
  metricsService?: MetricsService;
  /**
   * Optional BullMQ queue introspector (Sprint 29+).
   * When provided, queue depth gauges are populated on GET /metrics.
   */
  queueMetricsProvider?: QueueMetricsProvider;
  /** ISO timestamp of when this process started (Sprint 30+). */
  startedAt?: string;
  /**
   * Authentication configuration (Sprint 31+).
   * When absent, auth is disabled and GET /auth/health reports authEnabled: false.
   */
  authConfig?: AuthConfig;
  /**
   * Optional queue management service (Sprint 32+).
   * When absent, all /queue/* routes return 503.
   * In production this wraps the BullMQ publishing queue.
   */
  queueService?: QueueService;
  /**
   * Optional publisher management service (Sprint 37+).
   * When absent, all /publishers/* routes return 503.
   * In production this wraps the PublisherRegistry with WordPress + Ghost.
   */
  publisherService?: PublisherManagementService;
  /**
   * Optional asset library service (Sprint 39+).
   * When absent, all /assets/* routes return 503.
   */
  assetLibrary?: AssetLibraryService;
  /**
   * Optional content composer service (Sprint 40+).
   * When absent, all /composer/* routes return 503.
   */
  composerService?: ContentComposerService;
  /**
   * Optional publishing queue enqueuer (Sprint 41+).
   * When absent, POST /composer/publish returns 503.
   */
  publishingEnqueuer?: PublishingQueueEnqueuer;
  /**
   * Optional calendar service (Sprint 43+).
   * When absent, /calendar/* routes return 503.
   */
  calendarService?: CalendarService;
  /**
   * Optional provider configuration service (Sprint 44+).
   * When absent, /providers/config/* routes return 503.
   */
  providerConfigService?: ProviderConfigService;
};

/**
 * Build and configure a Fastify application instance.
 *
 * Does NOT call fastify.listen(). Call server.ts to bind a port.
 * This separation makes the app fully testable via fastify.inject()
 * without needing a live network socket.
 */
export function buildApp(options: AppOptions) {
  const {
    config,
    checkDatabase,
    assetRepository,
    storageProvider,
    jobScheduler,
    processingEnqueuer,
    publishedContentRepo,
    dashboardRepo,
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
  } = options;

  const defaultAuthConfig: AuthConfig = {
    enabled: false,
    jwtEnabled: false,
    jwtSecret: '',
    jwtExpiresInSeconds: 3600,
    apiKeyEnabled: false,
    apiKeys: [],
  };
  const resolvedAuthConfig = authConfig ?? defaultAuthConfig;
  const authMiddleware = createAuthMiddleware(resolvedAuthConfig);

  const app = Fastify({
    logger: {
      level: config.logLevel,
      ...(config.env === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
    },
    /**
     * Request ID strategy:
     *   1. Echo the incoming X-Request-Id header if present.
     *   2. Generate a UUID v4 if absent.
     *   3. Always include in the response as X-Request-Id.
     */
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  // Global optional-auth hook — populates request.auth when valid credentials present.
  app.addHook('onRequest', authMiddleware.authenticateRequest);

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
    // Track successful uploads (Sprint 29 metrics).
    if (
      metricsService &&
      request.method === 'POST' &&
      (request.routeOptions?.url ?? '') === '/media' &&
      reply.statusCode === 201
    ) {
      metricsService.inc('uploadsTotal');
    }
  });

  app.register(rootRoutes);
  app.register(healthRoutes, {
    version: config.version,
    env: config.env,
    checkDatabase,
    metricsEnabled: !!metricsService,
    startedAt,
  });
  app.register(versionRoutes, {
    version: config.version,
    env: config.env,
  });

  if (assetRepository && storageProvider) {
    app.register(mediaRoutes, {
      assetRepository,
      storageProvider,
      jobScheduler,
      processingEnqueuer,
      organizationId: config.defaultOrgId,
      projectId: config.defaultProjectId,
      projectSlug: config.defaultProjectSlug,
    });
  }

  app.register(publishingRoutes, {
    publishedContentRepo,
    publishingConfig: config,
  });

  app.register(dashboardRoutes, {
    repo: dashboardRepo,
    checkDatabase,
    publishingConfig: config,
  });

  app.register(metricsRoutes, {
    metricsService,
    queueMetricsProvider,
  });

  const authRouteOptions: AuthRouteOptions = {
    authConfig: resolvedAuthConfig,
    version: config.version,
    middleware: authMiddleware,
  };
  app.register(authRoutes, authRouteOptions);

  app.register(queueRoutes, {
    queueService,
    authMiddleware,
  });

  app.register(jobsRoutes, {
    queueService,
    authMiddleware,
    publishingConfig: config,
  });

  app.register(publishersRoutes, {
    publisherService,
  });

  app.register(assetsRoutes, {
    assetLibrary,
    storageProvider,
    defaultProjectId: config.defaultProjectId,
  });

  app.register(composerRoutes, {
    composerService,
    publishingEnqueuer,
    authMiddleware,
    defaultProjectId: config.defaultProjectId,
  });

  app.register(calendarRoutes, {
    calendarService,
    authMiddleware,
  });

  app.register(providerConfigRoutes, {
    providerConfigService,
    authMiddleware,
  });

  return app;
}
