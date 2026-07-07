/**
 * Response timing and safe cache-control headers — Sprint 49.
 */

import type { FastifyInstance } from 'fastify';

import type { MetricsService } from '../metrics.js';

/** Routes that may be cached briefly (immutable or slow-changing metadata). */
const SHORT_CACHE_PATHS = new Set(['/', '/version']);

/** Routes that must never be cached (live operational data). */
const NO_STORE_PATHS = new Set(['/metrics', '/health', '/dashboard/health']);

declare module 'fastify' {
  interface FastifyRequest {
    _pcmeStartMs?: number;
  }
}

export function registerPerformanceMiddleware(
  app: FastifyInstance,
  metricsService?: MetricsService,
): void {
  app.addHook('onRequest', async (request) => {
    request._pcmeStartMs = Date.now();
  });

  app.addHook('onSend', async (request, reply) => {
    const startMs = request._pcmeStartMs ?? Date.now();
    const elapsed = Date.now() - startMs;
    void reply.header('x-response-time-ms', String(elapsed));
    metricsService?.recordResponseTime(elapsed);

    const path = request.routeOptions?.url ?? request.url.split('?')[0] ?? '';
    if (NO_STORE_PATHS.has(path)) {
      void reply.header('cache-control', 'no-store');
    } else if (SHORT_CACHE_PATHS.has(path) && request.method === 'GET') {
      void reply.header('cache-control', 'public, max-age=60');
    } else if (request.method === 'GET') {
      void reply.header('cache-control', 'no-store');
    }
  });
}
