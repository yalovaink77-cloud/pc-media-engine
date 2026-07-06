/**
 * Publisher management dashboard smoke — Sprint 37.
 *
 * Offline — uses mocked DashboardApiClient via fastify.inject().
 *
 * Run: pnpm --filter @pcme/dashboard smoke:publishers
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type { PublisherDetail, PublisherListItem } from '../src/types.js';

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

const capabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: true,
  featuredImages: true,
  scheduling: false,
  update: false,
  delete: false,
};

const publishersFixture: PublisherListItem[] = [
  {
    id: 'wordpress',
    displayName: 'WordPress',
    version: '1.0.0',
    enabled: true,
    capabilities,
    supportsHealthCheck: true,
  },
  {
    id: 'ghost',
    displayName: 'Ghost',
    version: '1.0.0',
    enabled: false,
    capabilities: { ...capabilities, categories: false },
    supportsHealthCheck: true,
  },
];

const wordpressDetail: PublisherDetail = {
  ...publishersFixture[0]!,
  description: 'WordPress REST API publisher',
  configurationRequirements: [{ envVar: 'WORDPRESS_URL', required: true, description: 'Site URL' }],
};

let healthCalledFor = '';

function makePublisherClient(): DashboardApiClient {
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
    fetchPublishers: async () => publishersFixture,
    fetchPublisherDetail: async (id) => {
      if (id === 'wordpress') return wordpressDetail;
      if (id === 'ghost') return null;
      return null;
    },
    fetchPublisherHealth: async (id) => {
      healthCalledFor = id;
      if (id === 'wordpress') {
        return { healthy: true, latency: 55, message: 'Authenticated as admin' };
      }
      return {
        healthy: false,
        latency: 0,
        message: 'Provider is disabled — required configuration is missing',
      };
    },
    fetchJobs: async () => null,
    fetchJob: async () => null,
    fetchAssets: async () => null,
    fetchAsset: async () => null,
    fetchComposerAssets: async () => null,
    fetchComposerAsset: async () => null,
    validateComposer: async () => null,
    publishComposer: async () => null,
  };
}

async function main(): Promise<void> {
  const app = buildDashboardApp({ client: makePublisherClient() });
  await app.ready();

  section('1 · Publishers page renders');
  {
    const res = await app.inject({ method: 'GET', url: '/publishers' });
    assert(res.statusCode === 200, 'GET /publishers returns 200');
    assert(res.body.includes('Publisher Management'), 'page title present');
    assert(res.body.includes('data-testid="publishers-section"'), 'publishers section present');
    assert(res.body.includes('data-testid="publisher-card-wordpress"'), 'wordpress card present');
    assert(res.body.includes('data-testid="publisher-card-ghost"'), 'ghost card present');
    assert(res.body.includes('Enabled'), 'enabled badge shown');
    assert(res.body.includes('Disabled'), 'disabled badge shown');
    assert(res.body.includes('WORDPRESS_URL'), 'config requirements shown');
    assert(res.body.includes('data-testid="health-form-wordpress"'), 'health form present');
    assert(
      res.body.includes('data-testid="detail-unavailable-ghost"'),
      'unavailable detail handled',
    );
  }

  section('2 · Health check action');
  {
    healthCalledFor = '';
    const res = await app.inject({ method: 'POST', url: '/ops/publishers/wordpress/health' });
    assert(res.statusCode === 302, 'health action redirects');
    assert(healthCalledFor === 'wordpress', 'fetchPublisherHealth called');
    const location = res.headers.location ?? '';
    const page = await app.inject({ method: 'GET', url: location });
    assert(page.body.includes('data-testid="flash-banner"'), 'flash banner shown');
    assert(page.body.includes('Healthy'), 'healthy message displayed');
    assert(page.body.includes('Authenticated as admin'), 'provider message displayed');
  }

  section('3 · Unhealthy provider display');
  {
    const res = await app.inject({ method: 'POST', url: '/ops/publishers/ghost/health' });
    assert(res.statusCode === 302, 'unhealthy still redirects (no crash)');
    const page = await app.inject({ method: 'GET', url: res.headers.location ?? '' });
    assert(page.statusCode === 200, 'page renders after unhealthy check');
    assert(page.body.includes('Unhealthy'), 'unhealthy message displayed');
    assert(page.body.includes('configuration'), 'explains missing config');
  }

  await app.close();
  console.log('\n✅  All publisher management dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
