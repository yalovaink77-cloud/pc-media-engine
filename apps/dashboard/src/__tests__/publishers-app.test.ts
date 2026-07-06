import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type {
  PublisherDetail,
  PublisherHealthResult,
  PublisherListItem,
  QueueActionResult,
} from '../types.js';

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
];

const detailFixture: PublisherDetail = {
  ...publishersFixture[0]!,
  description: 'WordPress REST API',
  configurationRequirements: [{ envVar: 'WORDPRESS_URL', required: true, description: 'Site URL' }],
};

function makeMockClient(): DashboardApiClient {
  const noop = async (): Promise<QueueActionResult> => ({ ok: true, status: 200, message: 'OK' });
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
    fetchPublisherDetail: async (id) => (id === 'wordpress' ? detailFixture : null),
    fetchPublisherHealth: async (id): Promise<PublisherHealthResult> => ({
      healthy: id === 'wordpress',
      latency: 25,
      message: id === 'wordpress' ? 'Authenticated as admin' : 'Not configured',
    }),
  };
}

describe('GET /publishers', () => {
  let app: ReturnType<typeof buildDashboardApp>;

  beforeEach(async () => {
    app = buildDashboardApp({ client: makeMockClient() });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('renders publisher management page', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishers' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Publisher Management');
    expect(res.body).toContain('data-testid="publisher-card-wordpress"');
    expect(res.body).toContain('Check Health');
  });
});

describe('POST /ops/publishers/:id/health', () => {
  let app: ReturnType<typeof buildDashboardApp>;

  beforeEach(async () => {
    app = buildDashboardApp({ client: makeMockClient() });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('redirects with health flash message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ops/publishers/wordpress/health',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/publishers?flash=');
    expect(res.headers.location).toContain('flashType=ok');
  });

  it('shows health result on redirected page', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/ops/publishers/wordpress/health',
    });
    const location = postRes.headers.location ?? '';
    const getRes = await app.inject({ method: 'GET', url: location });
    expect(getRes.body).toContain('data-testid="flash-banner"');
    expect(getRes.body).toContain('Healthy');
    expect(getRes.body).toContain('Authenticated as admin');
  });
});
