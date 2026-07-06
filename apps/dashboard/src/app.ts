import Fastify from 'fastify';

import type { DashboardApiClient } from './client.js';
import { fetchAllDashboardData } from './client.js';
import { renderDashboardPage } from './renderer.js';

export type DashboardAppOptions = {
  client: DashboardApiClient;
  logLevel?: string;
};

export function buildDashboardApp(options: DashboardAppOptions) {
  const { client, logLevel = 'info' } = options;

  const app = Fastify({ logger: { level: logLevel } });

  app.get('/', async (_request, reply) => {
    const { health, summary, recent, metrics, queueStatus, errors } =
      await fetchAllDashboardData(client);

    const html = renderDashboardPage({
      health,
      summary,
      recent,
      metrics,
      queueStatus,
      fetchedAt: new Date().toISOString(),
      errors,
    });

    return reply
      .status(200)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(html);
  });

  return app;
}
