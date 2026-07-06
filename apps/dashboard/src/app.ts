import type { FastifyReply } from 'fastify';
import Fastify from 'fastify';

import type { DashboardApiClient } from './client.js';
import { fetchAllDashboardData, fetchAllPublishersData } from './client.js';
import { renderDashboardPage, renderPublishersPage } from './renderer.js';
import type { DashboardFlash, PublisherHealthResult, QueueActionResult } from './types.js';

export type DashboardAppOptions = {
  client: DashboardApiClient;
  logLevel?: string;
  /** True when DASHBOARD_API_KEY is set — shown in ops panel hint. */
  apiKeyConfigured?: boolean;
};

function redirectWithFlash(reply: FastifyReply, result: QueueActionResult): void {
  const type = result.ok ? 'ok' : 'err';
  const flash = encodeURIComponent(result.message);
  void reply.redirect(302, `/?flash=${flash}&flashType=${type}`);
}

function redirectPublishersWithFlash(
  reply: FastifyReply,
  message: string,
  type: 'ok' | 'err',
): void {
  const flash = encodeURIComponent(message);
  void reply.redirect(302, `/publishers?flash=${flash}&flashType=${type}`);
}

function formatHealthFlash(id: string, health: PublisherHealthResult | null): QueueActionResult {
  if (!health) {
    return { ok: false, status: 0, message: `Could not reach health endpoint for "${id}"` };
  }
  const statusLabel = health.healthy ? 'Healthy' : 'Unhealthy';
  return {
    ok: health.healthy,
    status: health.healthy ? 200 : 503,
    message: `${id}: ${statusLabel} (${health.latency}ms) — ${health.message}`,
  };
}

export function buildDashboardApp(options: DashboardAppOptions) {
  const { client, logLevel = 'info', apiKeyConfigured = false } = options;

  const app = Fastify({ logger: { level: logLevel } });

  // Parse HTML form bodies for job ID forms.
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const params = new URLSearchParams(body as string);
        const parsed: Record<string, string> = {};
        for (const [key, value] of params) parsed[key] = value;
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.get('/', async (request, reply) => {
    const query = request.query as { flash?: string; flashType?: string };
    let flash: DashboardFlash | undefined;
    if (query.flash) {
      flash = {
        message: decodeURIComponent(query.flash),
        type: query.flashType === 'ok' ? 'ok' : 'err',
      };
    }

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
      flash,
      apiKeyConfigured,
    });

    return reply
      .status(200)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(html);
  });

  app.post('/ops/queue/pause', async (_request, reply) => {
    redirectWithFlash(reply, await client.pauseQueue());
  });

  app.post('/ops/queue/resume', async (_request, reply) => {
    redirectWithFlash(reply, await client.resumeQueue());
  });

  app.post('/ops/queue/drain', async (_request, reply) => {
    redirectWithFlash(reply, await client.drainQueue());
  });

  app.post<{ Body: { jobId?: string } }>('/ops/queue/retry', async (request, reply) => {
    const jobId = request.body?.jobId?.trim();
    if (!jobId) {
      redirectWithFlash(reply, { ok: false, status: 400, message: 'Job ID is required' });
      return;
    }
    redirectWithFlash(reply, await client.retryJob(jobId));
  });

  app.post<{ Body: { jobId?: string } }>('/ops/queue/remove', async (request, reply) => {
    const jobId = request.body?.jobId?.trim();
    if (!jobId) {
      redirectWithFlash(reply, { ok: false, status: 400, message: 'Job ID is required' });
      return;
    }
    redirectWithFlash(reply, await client.removeJob(jobId));
  });

  app.get('/publishers', async (request, reply) => {
    const query = request.query as { flash?: string; flashType?: string };
    let flash: DashboardFlash | undefined;
    if (query.flash) {
      flash = {
        message: decodeURIComponent(query.flash),
        type: query.flashType === 'ok' ? 'ok' : 'err',
      };
    }

    const { publishers, details, errors } = await fetchAllPublishersData(client);

    const html = renderPublishersPage({
      publishers,
      details,
      fetchedAt: new Date().toISOString(),
      errors,
      flash,
    });

    return reply
      .status(200)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(html);
  });

  app.post<{ Params: { id: string } }>('/ops/publishers/:id/health', async (request, reply) => {
    const { id } = request.params;
    const result = formatHealthFlash(id, await client.fetchPublisherHealth(id));
    redirectPublishersWithFlash(reply, result.message, result.ok ? 'ok' : 'err');
  });

  return app;
}
