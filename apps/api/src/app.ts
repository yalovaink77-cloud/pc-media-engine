import { randomUUID } from 'node:crypto';

import Fastify from 'fastify';

import type { Config } from './config.js';
import type { DatabaseStatus } from './routes/health.js';
import { healthRoutes } from './routes/health.js';
import { rootRoutes } from './routes/root.js';
import { versionRoutes } from './routes/version.js';

export type AppOptions = {
  config: Config;
  /**
   * Injected database check.
   * - undefined → skip DB check (tests, no DATABASE_URL configured)
   * - function  → called on every /health request
   *
   * Production wiring passes buildDatabaseCheck(config.databaseUrl).
   */
  checkDatabase?: () => Promise<DatabaseStatus>;
};

/**
 * Build and configure a Fastify application instance.
 *
 * Does NOT call fastify.listen(). Call server.ts to bind a port.
 * This separation makes the app fully testable via fastify.inject()
 * without needing a live network socket.
 */
export function buildApp(options: AppOptions) {
  const { config, checkDatabase } = options;

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

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  app.register(rootRoutes);
  app.register(healthRoutes, {
    version: config.version,
    env: config.env,
    checkDatabase,
  });
  app.register(versionRoutes, {
    version: config.version,
    env: config.env,
  });

  return app;
}
