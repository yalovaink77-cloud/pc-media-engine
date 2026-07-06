import type { FastifyReply } from 'fastify';
import Fastify from 'fastify';

import type { DashboardApiClient } from './client.js';
import { fetchAllDashboardData, fetchAllPublishersData } from './client.js';
import {
  renderAssetDetailPage,
  renderAssetsPage,
  renderDashboardPage,
  renderJobDetailPage,
  renderJobsPage,
  renderPublishersPage,
} from './renderer.js';
import type {
  AssetListFilters,
  DashboardFlash,
  JobListFilters,
  PublisherHealthResult,
  QueueActionResult,
} from './types.js';

export type DashboardAppOptions = {
  client: DashboardApiClient;
  logLevel?: string;
  /** True when DASHBOARD_API_KEY is set — shown in ops panel hint. */
  apiKeyConfigured?: boolean;
  /** API base URL for asset thumbnail/download links in HTML. */
  apiBaseUrl?: string;
};

function redirectWithFlash(reply: FastifyReply, result: QueueActionResult): void {
  const type = result.ok ? 'ok' : 'err';
  const flash = encodeURIComponent(result.message);
  void reply.redirect(302, `/?flash=${flash}&flashType=${type}`);
}

function redirectJobsWithFlash(reply: FastifyReply, message: string, type: 'ok' | 'err'): void {
  const flash = encodeURIComponent(message);
  void reply.redirect(302, `/jobs?flash=${flash}&flashType=${type}`);
}

function redirectJobDetailWithFlash(
  reply: FastifyReply,
  jobId: string,
  message: string,
  type: 'ok' | 'err',
): void {
  const flash = encodeURIComponent(message);
  void reply.redirect(302, `/jobs/${encodeURIComponent(jobId)}?flash=${flash}&flashType=${type}`);
}

function parseJobFilters(query: Record<string, string | undefined>): JobListFilters {
  const filters: JobListFilters = {};
  if (query.status) filters.status = query.status;
  if (query.publisher) filters.publisher = query.publisher;
  if (query.projectId) filters.projectId = query.projectId;
  if (query.assetId) filters.assetId = query.assetId;
  if (query.limit) {
    const limit = parseInt(query.limit, 10);
    if (!Number.isNaN(limit)) filters.limit = limit;
  }
  if (query.offset) {
    const offset = parseInt(query.offset, 10);
    if (!Number.isNaN(offset)) filters.offset = offset;
  }
  return filters;
}

function parseAssetFilters(query: Record<string, string | undefined>): AssetListFilters {
  const filters: AssetListFilters = {};
  if (query.projectId) filters.projectId = query.projectId;
  if (query.status) filters.status = query.status;
  if (query.mimeType) filters.mimeType = query.mimeType;
  if (query.limit) {
    const limit = parseInt(query.limit, 10);
    if (!Number.isNaN(limit)) filters.limit = limit;
  }
  if (query.offset) {
    const offset = parseInt(query.offset, 10);
    if (!Number.isNaN(offset)) filters.offset = offset;
  }
  return filters;
}

function parseFlash(query: { flash?: string; flashType?: string }): DashboardFlash | undefined {
  if (!query.flash) return undefined;
  return {
    message: decodeURIComponent(query.flash),
    type: query.flashType === 'ok' ? 'ok' : 'err',
  };
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
  const { client, logLevel = 'info', apiKeyConfigured = false, apiBaseUrl = '' } = options;

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
    const flash = parseFlash(request.query as { flash?: string; flashType?: string });

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
    const flash = parseFlash(request.query as { flash?: string; flashType?: string });

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

  app.get('/jobs', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const filters = parseJobFilters(query);
    const result = await client.fetchJobs(filters);
    const errors: string[] = [];
    if (!result) errors.push('Could not reach /jobs — check DASHBOARD_API_KEY and Redis');

    const html = renderJobsPage({
      result,
      filters,
      fetchedAt: new Date().toISOString(),
      errors,
      flash: parseFlash(query),
      apiKeyConfigured,
    });

    return reply
      .status(200)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(html);
  });

  app.get<{ Params: { id: string } }>('/jobs/:id', async (request, reply) => {
    const { id } = request.params;
    const query = request.query as { flash?: string; flashType?: string };
    const job = await client.fetchJob(id);
    const errors: string[] = [];
    if (!job) errors.push(`Could not load job "${id}"`);

    const html = renderJobDetailPage({
      job,
      fetchedAt: new Date().toISOString(),
      errors,
      flash: parseFlash(query),
      apiKeyConfigured,
    });

    return reply
      .status(200)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(html);
  });

  app.post<{ Params: { id: string } }>('/ops/jobs/:id/retry', async (request, reply) => {
    const { id } = request.params;
    const result = await client.retryJob(id);
    redirectJobDetailWithFlash(reply, id, result.message, result.ok ? 'ok' : 'err');
  });

  app.post<{ Params: { id: string } }>('/ops/jobs/:id/remove', async (request, reply) => {
    const { id } = request.params;
    const result = await client.removeJob(id);
    if (result.ok) {
      redirectJobsWithFlash(reply, result.message, 'ok');
      return;
    }
    redirectJobDetailWithFlash(reply, id, result.message, 'err');
  });

  app.get('/assets', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const filters = parseAssetFilters(query);
    const result = await client.fetchAssets(filters);
    const errors: string[] = [];
    if (!result) errors.push('Could not reach /assets — is the API database configured?');

    const html = renderAssetsPage({
      result,
      filters,
      fetchedAt: new Date().toISOString(),
      errors,
      apiBaseUrl,
    });

    return reply
      .status(200)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(html);
  });

  app.get<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const { id } = request.params;
    const asset = await client.fetchAsset(id);
    const errors: string[] = [];
    if (!asset) errors.push(`Could not load asset "${id}"`);

    const html = renderAssetDetailPage({
      asset,
      fetchedAt: new Date().toISOString(),
      errors,
      apiBaseUrl,
    });

    return reply
      .status(200)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(html);
  });

  return app;
}
