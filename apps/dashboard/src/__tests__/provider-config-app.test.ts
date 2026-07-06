import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type { ProviderConfigDetail, ProviderConfigSummary } from '../types.js';

const wordpressSummary: ProviderConfigSummary = {
  id: 'wordpress',
  displayName: 'WordPress',
  enabled: true,
  configured: true,
  configurationStatus: 'complete',
  requiredFields: [
    {
      envVar: 'WORDPRESS_URL',
      description: 'Site URL',
      required: true,
      configured: true,
      value: 'https://wp.test',
    },
    {
      envVar: 'WORDPRESS_APP_PASSWORD',
      description: 'App password',
      required: true,
      configured: true,
      masked: '****uvwx',
    },
  ],
  optionalFields: [],
  supportsHotReload: true,
};

const wordpressDetail: ProviderConfigDetail = {
  ...wordpressSummary,
  version: '1.0.0',
  description: 'WordPress publisher',
};

function makeClient(): DashboardApiClient {
  const noop = async () => ({ ok: true, status: 200, message: 'OK' });
  return {
    fetchHealth: async () => null,
    fetchSummary: async () => null,
    fetchRecent: async () => null,
    fetchMetrics: async () => null,
    fetchQueueStatus: async () => null,
    pauseQueue: noop,
    resumeQueue: noop,
    drainQueue: noop,
    retryJob: noop,
    removeJob: noop,
    fetchPublishers: async () => null,
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => ({ healthy: true, latency: 5, message: 'ok' }),
    fetchJobs: async () => null,
    fetchJob: async () => null,
    fetchAssets: async () => null,
    fetchAsset: async () => null,
    fetchComposerAssets: async () => null,
    fetchComposerAsset: async () => null,
    validateComposer: async () => null,
    publishComposer: async () => null,
    bulkPublishComposer: async () => null,
    fetchCalendarEvents: async () => null,
    fetchCalendarTimeline: async () => null,
    fetchProviderConfigs: async () => ({ providers: [wordpressSummary], count: 1 }),
    fetchProviderConfig: async (id) => (id === 'wordpress' ? wordpressDetail : null),
    validateProviderConfig: async () => ({ valid: true, errors: [], warnings: [] }),
    updateProviderConfig: async () => ({
      ok: true,
      status: 200,
      detail: wordpressDetail,
      validation: null,
    }),
  };
}

describe('GET /provider-config', () => {
  let app: ReturnType<typeof buildDashboardApp>;

  beforeEach(() => {
    app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('renders provider configuration page', async () => {
    const res = await app.inject({ method: 'GET', url: '/provider-config' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Provider Configuration');
    expect(res.body).toContain('provider-config-card-wordpress');
    expect(res.body).toContain('****uvwx');
  });

  it('renders edit form when edit query set', async () => {
    const res = await app.inject({ method: 'GET', url: '/provider-config?edit=wordpress' });
    expect(res.body).toContain('edit-form-wordpress');
    expect(res.body).toContain('validate-btn-wordpress');
    expect(res.body).toContain('save-btn-wordpress');
  });
});

describe('POST /ops/provider-config/:id/validate', () => {
  let app: ReturnType<typeof buildDashboardApp>;

  beforeEach(() => {
    app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('redirects with validation result', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ops/provider-config/wordpress/validate',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'WORDPRESS_URL=https%3A%2F%2Fwp.test',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/provider-config');
  });
});

describe('POST /ops/provider-config/:id/save', () => {
  let app: ReturnType<typeof buildDashboardApp>;

  beforeEach(() => {
    app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('redirects after save', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ops/provider-config/wordpress/save',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'WORDPRESS_URL=https%3A%2F%2Fwp.test',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('flashType=ok');
  });
});
