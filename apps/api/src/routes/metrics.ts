import type { FastifyInstance } from 'fastify';

import type { MetricsService, MetricsSnapshot } from '../metrics.js';

// ---------------------------------------------------------------------------
// Optional queue metrics provider (injected when BullMQ is available)
// ---------------------------------------------------------------------------

export type QueueMetrics = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
};

export interface QueueMetricsProvider {
  getQueueMetrics(): Promise<QueueMetrics>;
}

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export type MetricsRouteOptions = {
  /**
   * In-process metrics accumulator.
   * When absent the endpoint returns all-zero counters.
   */
  metricsService?: MetricsService;
  /**
   * Optional BullMQ queue introspector.
   * When absent, queue gauges are reported as 0.
   */
  queueMetricsProvider?: QueueMetricsProvider;
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function metricsRoutes(
  app: FastifyInstance,
  options: MetricsRouteOptions,
): Promise<void> {
  const { metricsService, queueMetricsProvider } = options;

  app.get<{ Reply: MetricsSnapshot }>(
    '/metrics',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              uploadsTotal: { type: 'number' },
              processedTotal: { type: 'number' },
              publishedTotal: { type: 'number' },
              retriesTotal: { type: 'number' },
              failuresTotal: { type: 'number' },
              duplicateSkipsTotal: { type: 'number' },
              schedulerJobsTotal: { type: 'number' },
              queueWaiting: { type: 'number' },
              queueActive: { type: 'number' },
              queueCompleted: { type: 'number' },
              queueFailed: { type: 'number' },
              collectedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const snap = metricsService?.snapshot() ?? {
        uploadsTotal: 0,
        processedTotal: 0,
        publishedTotal: 0,
        retriesTotal: 0,
        failuresTotal: 0,
        duplicateSkipsTotal: 0,
        schedulerJobsTotal: 0,
        queueWaiting: 0,
        queueActive: 0,
        queueCompleted: 0,
        queueFailed: 0,
        collectedAt: new Date().toISOString(),
      };

      // Overlay live queue gauges when available.
      if (queueMetricsProvider && metricsService) {
        try {
          const q = await queueMetricsProvider.getQueueMetrics();
          metricsService.set('queueWaiting', q.waiting);
          metricsService.set('queueActive', q.active);
          metricsService.set('queueCompleted', q.completed);
          metricsService.set('queueFailed', q.failed);
        } catch {
          // Queue introspection is best-effort; never fail the endpoint.
        }
      }

      return reply.status(200).send(snap);
    },
  );
}
