import type { PublisherCapabilities } from '@pcme/publisher-sdk';
import { PublisherRegistry } from '@pcme/publisher-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import { createPublisherService } from '../publishers/publisher-service.js';
import type { PublisherManagementService } from '../publishers/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.0.0-test',
  databaseUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: '',
  defaultProjectId: '',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const mockCapabilities: PublisherCapabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: false,
  featuredImages: true,
  scheduling: false,
  update: false,
  delete: false,
};

function makeMockPublisherService(): PublisherManagementService {
  return {
    listPublishers: () => [
      {
        id: 'mock-provider',
        displayName: 'Mock Provider',
        version: '9.9.9',
        enabled: true,
        capabilities: mockCapabilities,
        supportsHealthCheck: true,
      },
    ],
    getPublisher: (id: string) => {
      if (id !== 'mock-provider') return null;
      return {
        id: 'mock-provider',
        displayName: 'Mock Provider',
        version: '9.9.9',
        description: 'A mock provider for tests',
        enabled: true,
        capabilities: mockCapabilities,
        supportsHealthCheck: true,
        configurationRequirements: [
          { envVar: 'MOCK_URL', required: true, description: 'Mock URL' },
        ],
      };
    },
    checkHealth: async (id: string) => {
      if (id !== 'mock-provider') {
        return { healthy: false, latency: 0, message: 'Not found' };
      }
      return { healthy: true, latency: 12, message: 'Mock provider is healthy' };
    },
  };
}

// ---------------------------------------------------------------------------
// Route tests
// ---------------------------------------------------------------------------

describe('GET /publishers', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    app = buildApp({
      config: baseConfig,
      publisherService: makeMockPublisherService(),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns registered publishers', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishers' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      publishers: Array<{ id: string; displayName: string; supportsHealthCheck: boolean }>;
      count: number;
    };
    expect(body.count).toBe(1);
    expect(body.publishers[0]?.id).toBe('mock-provider');
    expect(body.publishers[0]?.displayName).toBe('Mock Provider');
    expect(body.publishers[0]?.supportsHealthCheck).toBe(true);
  });

  it('returns 503 when service is absent', async () => {
    const noServiceApp = buildApp({ config: baseConfig });
    await noServiceApp.ready();
    const res = await noServiceApp.inject({ method: 'GET', url: '/publishers' });
    expect(res.statusCode).toBe(503);
    await noServiceApp.close();
  });
});

describe('GET /publishers/:id', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    app = buildApp({
      config: baseConfig,
      publisherService: makeMockPublisherService(),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns publisher detail with configuration requirements', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishers/mock-provider' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      id: string;
      configurationRequirements: Array<{ envVar: string }>;
    };
    expect(body.id).toBe('mock-provider');
    expect(body.configurationRequirements[0]?.envVar).toBe('MOCK_URL');
  });

  it('returns 404 for unknown provider', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishers/unknown' });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /publishers/:id/health', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    app = buildApp({
      config: baseConfig,
      publisherService: makeMockPublisherService(),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns health result', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishers/mock-provider/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { healthy: boolean; latency: number; message: string };
    expect(body.healthy).toBe(true);
    expect(body.latency).toBe(12);
    expect(body.message).toContain('healthy');
  });

  it('returns 404 for unknown provider', async () => {
    const res = await app.inject({ method: 'GET', url: '/publishers/unknown/health' });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Publisher service integration
// ---------------------------------------------------------------------------

describe('createPublisherService', () => {
  it('lists WordPress and Ghost from default registry', () => {
    const service = createPublisherService({ env: {} });
    const ids = service
      .listPublishers()
      .map((p) => p.id)
      .sort();
    expect(ids).toEqual(['ghost', 'wordpress']);
  });

  it('reports providers as disabled without env config', () => {
    const service = createPublisherService({ env: {} });
    for (const publisher of service.listPublishers()) {
      expect(publisher.enabled).toBe(false);
      expect(publisher.supportsHealthCheck).toBe(true);
    }
  });

  it('reports WordPress as enabled when config is complete', () => {
    const service = createPublisherService({
      env: {
        WORDPRESS_URL: 'https://example.com',
        WORDPRESS_USERNAME: 'admin',
        WORDPRESS_APP_PASSWORD: 'abcd efgh ijkl mnop',
      },
    });
    const wp = service.listPublishers().find((p) => p.id === 'wordpress');
    expect(wp?.enabled).toBe(true);
  });

  it('returns configuration requirements for WordPress', () => {
    const service = createPublisherService({ env: {} });
    const detail = service.getPublisher('wordpress');
    expect(detail?.configurationRequirements.length).toBeGreaterThan(0);
    expect(detail?.configurationRequirements.some((r) => r.envVar === 'WORDPRESS_URL')).toBe(true);
  });

  it('health check reports missing config for disabled provider', async () => {
    const service = createPublisherService({ env: {} });
    const health = await service.checkHealth('wordpress');
    expect(health.healthy).toBe(false);
    expect(health.message).toContain('configuration');
  });

  it('returns null for unknown provider detail', () => {
    const service = createPublisherService({ env: {} });
    expect(service.getPublisher('nonexistent')).toBeNull();
  });
});

describe('PublisherRegistry', () => {
  it('registers and lists providers', () => {
    const registry = new PublisherRegistry();
    registry.register({
      metadata: {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test provider',
        capabilities: mockCapabilities,
      },
      factory: () =>
        ({
          name: 'Test',
          getMetadata: () => registry.listMetadata()[0]!,
          getCapabilities: () => mockCapabilities,
          publish: async () => ({
            success: true,
            externalId: '1',
            url: 'https://example.com',
            publishedAt: new Date(),
          }),
          publishMedia: async () => ({
            success: true,
            externalId: '1',
            url: 'https://example.com',
            publishedAt: new Date(),
          }),
          publishPost: async () => ({
            success: true,
            externalId: '1',
            url: 'https://example.com',
            publishedAt: new Date(),
          }),
          health: async () => ({ status: 'ok' as const }),
        }) as never,
    });
    expect(registry.has('test')).toBe(true);
    expect(registry.listMetadata()).toHaveLength(1);
  });
});
