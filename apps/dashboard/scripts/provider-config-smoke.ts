/**
 * Provider configuration dashboard smoke — Sprint 44.
 *
 * Offline — uses mocked DashboardApiClient via fastify.inject().
 *
 * Run: pnpm --filter @pcme/dashboard provider-config:smoke
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type { ProviderConfigDetail, ProviderConfigSummary } from '../src/types.js';

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}
function fail(label: string, detail?: unknown): never {
  console.error(`  ✗ ${label}`, detail ?? '');
  process.exit(1);
}
function assert(cond: boolean, label: string, detail?: unknown): void {
  if (!cond) fail(label, detail);
  pass(label);
}
function section(title: string): void {
  console.log(`\n[${title}]`);
}

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
      value: 'https://wp.smoke.test',
    },
    {
      envVar: 'WORDPRESS_USERNAME',
      description: 'Username',
      required: true,
      configured: true,
      value: 'admin',
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
  description: 'WordPress REST API publisher',
  validation: { valid: true, errors: [], warnings: [] },
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
    fetchPublisherHealth: async () => ({
      healthy: true,
      latency: 12,
      message: 'Healthy',
    }),
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
    fetchProviderConfigs: async () => ({
      providers: [wordpressSummary],
      count: 1,
    }),
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

async function main(): Promise<void> {
  const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });

  section('1 · Provider config page');
  const pageRes = await app.inject({ method: 'GET', url: '/provider-config' });
  assert(pageRes.statusCode === 200, 'GET /provider-config returns 200');
  const html = pageRes.body;
  assert(html.includes('Provider Configuration'), 'page title');
  assert(html.includes('provider-config-section'), 'config section');
  assert(html.includes('provider-config-card-wordpress'), 'provider card');
  assert(html.includes('****uvwx'), 'secret masked in display');
  assert(!html.includes('qrst uvwx'), 'raw secret not in HTML');

  section('2 · Edit dialog');
  const editRes = await app.inject({ method: 'GET', url: '/provider-config?edit=wordpress' });
  assert(editRes.statusCode === 200, 'edit view returns 200');
  assert(editRes.body.includes('edit-form-wordpress'), 'edit form shown');
  assert(editRes.body.includes('validate-btn-wordpress'), 'validate button');
  assert(editRes.body.includes('save-btn-wordpress'), 'save button');

  section('3 · Validate action');
  const validateRes = await app.inject({
    method: 'POST',
    url: '/ops/provider-config/wordpress/validate',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'WORDPRESS_URL=https%3A%2F%2Fwp.smoke.test&WORDPRESS_USERNAME=admin',
  });
  assert(validateRes.statusCode === 302, 'validate redirects');
  assert(validateRes.headers.location?.includes('/provider-config'), 'redirects to config page');

  section('4 · Save action');
  const saveRes = await app.inject({
    method: 'POST',
    url: '/ops/provider-config/wordpress/save',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'WORDPRESS_URL=https%3A%2F%2Fwp.smoke.test',
  });
  assert(saveRes.statusCode === 302, 'save redirects');

  section('5 · Health action');
  const healthRes = await app.inject({
    method: 'POST',
    url: '/ops/provider-config/wordpress/health',
  });
  assert(healthRes.statusCode === 302, 'health redirects');

  console.log('\n✅  All provider configuration dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
