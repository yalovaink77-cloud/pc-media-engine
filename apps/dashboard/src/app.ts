import type { FastifyReply } from 'fastify';
import Fastify from 'fastify';

import type { DashboardApiClient } from './client.js';
import { fetchAllDashboardData, fetchAllPublishersData } from './client.js';
import type { DashboardRbac } from './rbac.js';
import { loadDashboardRbac, permissionDeniedMessage } from './rbac.js';
import { setDashboardRbacContext } from './renderer.js';
import {
  renderAssetDetailPage,
  renderAssetsPage,
  renderBulkPublishPage,
  renderCalendarPage,
  renderComposerPage,
  renderDashboardPage,
  renderJobDetailPage,
  renderJobsPage,
  renderProviderConfigPage,
  renderPublishersPage,
} from './renderer.js';
import type {
  AssetListFilters,
  ComposerBulkPublishResult,
  ComposerPublishResult,
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
  /** Sprint 45 RBAC context for UI adaptation. */
  rbac?: DashboardRbac;
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

function redirectProviderConfigWithFlash(
  reply: FastifyReply,
  message: string,
  type: 'ok' | 'err',
  extraParams?: Record<string, string>,
): void {
  const params = new URLSearchParams({
    flash: message,
    flashType: type,
  });
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) params.set(key, value);
  }
  void reply.redirect(302, `/provider-config?${params.toString()}`);
}

function parseProviderConfigForm(body: Record<string, string> | undefined): Record<string, string> {
  if (!body) return {};
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key && value !== undefined) values[key] = value;
  }
  return values;
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

function redirectQueueDenied(reply: FastifyReply, message: string, type: 'ok' | 'err'): void {
  redirectWithFlash(reply, { ok: type === 'ok', status: type === 'ok' ? 200 : 403, message });
}

export function buildDashboardApp(options: DashboardAppOptions) {
  const {
    client,
    logLevel = 'info',
    apiKeyConfigured = false,
    apiBaseUrl = '',
    rbac = loadDashboardRbac(),
  } = options;

  setDashboardRbacContext(rbac);

  function denyIfNoPermission(
    reply: FastifyReply,
    permission: Parameters<DashboardRbac['can']>[0],
    redirect: (reply: FastifyReply, message: string, type: 'ok' | 'err') => void,
  ): boolean {
    if (!rbac.enabled || rbac.can(permission)) return true;
    redirect(reply, permissionDeniedMessage(permission), 'err');
    return false;
  }

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

  app.post('/ops/queue/pause', async (request, reply) => {
    if (!denyIfNoPermission(reply, 'queue:write', redirectQueueDenied)) return;
    redirectWithFlash(reply, await client.pauseQueue());
  });

  app.post('/ops/queue/resume', async (request, reply) => {
    if (!denyIfNoPermission(reply, 'queue:write', redirectQueueDenied)) return;
    redirectWithFlash(reply, await client.resumeQueue());
  });

  app.post('/ops/queue/drain', async (request, reply) => {
    if (!denyIfNoPermission(reply, 'queue:write', redirectQueueDenied)) return;
    redirectWithFlash(reply, await client.drainQueue());
  });

  app.post<{ Body: { jobId?: string } }>('/ops/queue/retry', async (request, reply) => {
    if (!denyIfNoPermission(reply, 'queue:write', redirectQueueDenied)) return;
    const jobId = request.body?.jobId?.trim();
    if (!jobId) {
      redirectWithFlash(reply, { ok: false, status: 400, message: 'Job ID is required' });
      return;
    }
    redirectWithFlash(reply, await client.retryJob(jobId));
  });

  app.post<{ Body: { jobId?: string } }>('/ops/queue/remove', async (request, reply) => {
    if (!denyIfNoPermission(reply, 'queue:write', redirectQueueDenied)) return;
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

  app.get('/provider-config', async (request, reply) => {
    const query = request.query as {
      flash?: string;
      flashType?: string;
      edit?: string;
      validation?: string;
    };
    const errors: string[] = [];
    const list = await client.fetchProviderConfigs();
    if (!list) errors.push('Could not reach /providers/config — is the API running?');

    const providers = list?.providers ?? [];
    const details: Record<
      string,
      Awaited<ReturnType<DashboardApiClient['fetchProviderConfig']>>
    > = {};
    await Promise.all(
      providers.map(async (p) => {
        details[p.id] = await client.fetchProviderConfig(p.id);
      }),
    );

    let validationResult = undefined;
    if (query.validation) {
      try {
        validationResult = JSON.parse(decodeURIComponent(query.validation)) as {
          valid: boolean;
          errors: string[];
          warnings: string[];
        };
      } catch {
        errors.push('Could not parse validation result');
      }
    }

    const html = renderProviderConfigPage({
      providers,
      details,
      editProviderId: query.edit,
      validationResult,
      fetchedAt: new Date().toISOString(),
      errors,
      flash: parseFlash(query),
    });

    return reply
      .status(200)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(html);
  });

  app.post<{ Params: { id: string }; Body: Record<string, string> }>(
    '/ops/provider-config/:id/validate',
    async (request, reply) => {
      if (!denyIfNoPermission(reply, 'providers:write', redirectProviderConfigWithFlash)) return;
      const { id } = request.params;
      const values = parseProviderConfigForm(request.body);
      const result = await client.validateProviderConfig(id, values);
      if (!result) {
        redirectProviderConfigWithFlash(reply, `Validation request failed for "${id}"`, 'err', {
          edit: id,
        });
        return;
      }
      const params = {
        edit: id,
        validation: encodeURIComponent(JSON.stringify(result)),
      };
      const message = result.valid
        ? `Validation passed for "${id}"`
        : `Validation failed: ${result.errors.join('; ')}`;
      redirectProviderConfigWithFlash(reply, message, result.valid ? 'ok' : 'err', params);
    },
  );

  app.post<{ Params: { id: string }; Body: Record<string, string> }>(
    '/ops/provider-config/:id/save',
    async (request, reply) => {
      if (!denyIfNoPermission(reply, 'providers:write', redirectProviderConfigWithFlash)) return;
      const { id } = request.params;
      const values = parseProviderConfigForm(request.body);
      const result = await client.updateProviderConfig(id, values);
      if (result.ok && result.detail) {
        redirectProviderConfigWithFlash(reply, `Configuration saved for "${id}"`, 'ok');
        return;
      }
      const errMsg =
        result.validation?.errors.join('; ') ?? `Failed to save configuration for "${id}"`;
      redirectProviderConfigWithFlash(reply, errMsg, 'err', {
        edit: id,
        ...(result.validation
          ? { validation: encodeURIComponent(JSON.stringify(result.validation)) }
          : {}),
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/ops/provider-config/:id/health',
    async (request, reply) => {
      const { id } = request.params;
      const result = formatHealthFlash(id, await client.fetchPublisherHealth(id));
      redirectProviderConfigWithFlash(reply, result.message, result.ok ? 'ok' : 'err');
    },
  );

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
    if (!rbac.enabled || rbac.can('queue:write')) {
      const result = await client.retryJob(id);
      redirectJobDetailWithFlash(reply, id, result.message, result.ok ? 'ok' : 'err');
      return;
    }
    redirectJobDetailWithFlash(reply, id, permissionDeniedMessage('queue:write'), 'err');
  });

  app.post<{ Params: { id: string } }>('/ops/jobs/:id/remove', async (request, reply) => {
    const { id } = request.params;
    if (!rbac.enabled || rbac.can('queue:write')) {
      const result = await client.removeJob(id);
      if (result.ok) {
        redirectJobsWithFlash(reply, result.message, 'ok');
        return;
      }
      redirectJobDetailWithFlash(reply, id, result.message, 'err');
      return;
    }
    redirectJobDetailWithFlash(reply, id, permissionDeniedMessage('queue:write'), 'err');
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

  app.get('/composer', async (request, reply) => {
    const query = request.query as {
      assetId?: string;
      confirmPublish?: string;
      publishers?: string;
      publishSummary?: string;
    };
    const errors: string[] = [];
    const assets = await client.fetchComposerAssets();
    if (!assets) errors.push('Could not reach /composer/assets — is the API configured?');

    let selectedAsset = null;
    if (query.assetId) {
      selectedAsset = await client.fetchComposerAsset(query.assetId);
      if (!selectedAsset) errors.push(`Could not load composer asset "${query.assetId}"`);
    }

    let publishResult = null;
    if (query.publishSummary) {
      try {
        publishResult = JSON.parse(
          decodeURIComponent(query.publishSummary),
        ) as ComposerPublishResult;
      } catch {
        errors.push('Could not parse publish result summary');
      }
    }

    const selectedPublisherIds = query.publishers
      ? query.publishers
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;

    const html = renderComposerPage({
      assets,
      selectedAsset,
      selectedAssetId: query.assetId,
      selectedPublisherIds,
      confirmPublish: query.confirmPublish === '1',
      publishResult,
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

  app.post<{ Body: { assetId?: string; publisherIds?: string | string[]; confirm?: string } }>(
    '/ops/composer/publish',
    async (request, reply) => {
      if (
        !denyIfNoPermission(reply, 'publishing:write', (r, m, t) => {
          void reply.redirect(302, `/composer?flash=${encodeURIComponent(m)}&flashType=${t}`);
        })
      )
        return;
      const assetId = request.body?.assetId?.trim();
      const rawIds = request.body?.publisherIds;
      const publisherIds = Array.isArray(rawIds)
        ? rawIds.map((id) => id.trim()).filter(Boolean)
        : rawIds
          ? [rawIds.trim()]
          : [];
      const confirmed = request.body?.confirm === 'on' || request.body?.confirm === 'true';

      if (!assetId || !publisherIds.length) {
        void reply.redirect(302, '/composer');
        return;
      }

      if (!confirmed) {
        const params = new URLSearchParams({
          assetId,
          confirmPublish: '1',
          publishers: publisherIds.join(','),
        });
        void reply.redirect(302, `/composer?${params.toString()}`);
        return;
      }

      const result = await client.publishComposer(assetId, publisherIds);
      if (!result) {
        void reply.redirect(302, `/composer?assetId=${encodeURIComponent(assetId)}`);
        return;
      }

      const params = new URLSearchParams({
        assetId,
        publishSummary: encodeURIComponent(JSON.stringify(result)),
      });
      void reply.redirect(302, `/composer?${params.toString()}`);
    },
  );

  app.get('/bulk-publish', async (request, reply) => {
    const query = request.query as {
      confirmBulkPublish?: string;
      assets?: string;
      publishers?: string;
      bulkSummary?: string;
    };
    const errors: string[] = [];
    const assets = await client.fetchComposerAssets();
    if (!assets) errors.push('Could not reach /composer/assets — is the API configured?');

    const publishers = (await client.fetchPublishers()) ?? [];
    if (!publishers.length) errors.push('Could not reach /publishers');

    let bulkResult = null;
    if (query.bulkSummary) {
      try {
        bulkResult = JSON.parse(decodeURIComponent(query.bulkSummary)) as ComposerBulkPublishResult;
      } catch {
        errors.push('Could not parse bulk publish result summary');
      }
    }

    const selectedAssetIds = query.assets
      ? query.assets
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;
    const selectedPublisherIds = query.publishers
      ? query.publishers
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;

    const html = renderBulkPublishPage({
      assets,
      publishers,
      selectedAssetIds,
      selectedPublisherIds,
      confirmBulkPublish: query.confirmBulkPublish === '1',
      bulkResult,
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

  app.post<{
    Body: { assetIds?: string | string[]; publisherIds?: string | string[]; confirm?: string };
  }>('/ops/bulk-publish', async (request, reply) => {
    if (
      !denyIfNoPermission(reply, 'publishing:write', (r, m, t) => {
        void reply.redirect(302, `/bulk-publish?flash=${encodeURIComponent(m)}&flashType=${t}`);
      })
    )
      return;
    const rawAssetIds = request.body?.assetIds;
    const assetIds = Array.isArray(rawAssetIds)
      ? rawAssetIds.map((id) => id.trim()).filter(Boolean)
      : rawAssetIds
        ? [rawAssetIds.trim()]
        : [];
    const rawPublisherIds = request.body?.publisherIds;
    const publisherIds = Array.isArray(rawPublisherIds)
      ? rawPublisherIds.map((id) => id.trim()).filter(Boolean)
      : rawPublisherIds
        ? [rawPublisherIds.trim()]
        : [];
    const confirmed = request.body?.confirm === 'on' || request.body?.confirm === 'true';

    if (!assetIds.length || !publisherIds.length) {
      void reply.redirect(302, '/bulk-publish');
      return;
    }

    if (!confirmed) {
      const params = new URLSearchParams({
        confirmBulkPublish: '1',
        assets: assetIds.join(','),
        publishers: publisherIds.join(','),
      });
      void reply.redirect(302, `/bulk-publish?${params.toString()}`);
      return;
    }

    const result = await client.bulkPublishComposer(assetIds, publisherIds);
    if (!result) {
      void reply.redirect(302, '/bulk-publish');
      return;
    }

    const params = new URLSearchParams({
      bulkSummary: encodeURIComponent(JSON.stringify(result)),
    });
    void reply.redirect(302, `/bulk-publish?${params.toString()}`);
  });

  app.get('/calendar', async (request, reply) => {
    const query = request.query as {
      view?: string;
      start?: string;
      end?: string;
      eventId?: string;
    };
    const errors: string[] = [];

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ).toISOString();
    const rangeStart = query.start ?? defaultStart;
    const rangeEnd = query.end ?? defaultEnd;

    const viewRaw = query.view ?? 'month';
    const view =
      viewRaw === 'week' || viewRaw === 'list' || viewRaw === 'timeline' ? viewRaw : 'month';

    const events =
      view !== 'timeline' ? await client.fetchCalendarEvents(rangeStart, rangeEnd) : null;
    if (view !== 'timeline' && !events) {
      errors.push('Could not reach /calendar/events — is the API configured?');
    }

    const timeline =
      view === 'timeline'
        ? await client.fetchCalendarTimeline({ start: rangeStart, end: rangeEnd })
        : await client.fetchCalendarTimeline({ start: rangeStart, end: rangeEnd, limit: 50 });

    if (view === 'timeline' && !timeline) {
      errors.push('Could not reach /calendar/timeline');
    }

    const selectedEvent =
      query.eventId && events ? (events.events.find((e) => e.id === query.eventId) ?? null) : null;

    const html = renderCalendarPage({
      view,
      events,
      timeline,
      selectedEventId: query.eventId,
      selectedEvent,
      rangeStart,
      rangeEnd,
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
