import { describe, expect, it } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import { ProviderConfigStore } from '../providers/config-store.js';
import { createProviderConfigService } from '../providers/provider-config-service.js';
import { isMaskedPlaceholder, maskSecret } from '../providers/secret-fields.js';
import { createDefaultPublisherRegistry } from '../publishers/publisher-service.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.44.0-test',
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

const wordpressEnv = {
  WORDPRESS_URL: 'https://wp.example.com',
  WORDPRESS_USERNAME: 'admin',
  WORDPRESS_APP_PASSWORD: 'abcd efgh ijkl mnop qrst uvwx',
};

function makeProviderConfigService(env: Record<string, string | undefined> = {}) {
  const store = new ProviderConfigStore({ baseEnv: { ...wordpressEnv, ...env } });
  return createProviderConfigService({
    registry: createDefaultPublisherRegistry(),
    configStore: store,
  });
}

describe('secret masking', () => {
  it('masks secrets with last four characters', () => {
    expect(maskSecret('abcdefghijklmnop')).toBe('****mnop');
  });

  it('treats masked placeholders as preserve-existing', () => {
    expect(isMaskedPlaceholder('****mnop')).toBe(true);
    expect(isMaskedPlaceholder('')).toBe(true);
    expect(isMaskedPlaceholder('https://wp.test')).toBe(false);
  });
});

describe('createProviderConfigService', () => {
  it('lists all registered providers with configuration status', () => {
    const service = makeProviderConfigService();
    const result = service.listConfigs();
    expect(result.count).toBeGreaterThanOrEqual(2);
    const wp = result.providers.find((p) => p.id === 'wordpress');
    expect(wp?.configured).toBe(true);
    expect(wp?.configurationStatus).toBe('complete');
    expect(wp?.requiredFields.some((f) => f.envVar === 'WORDPRESS_APP_PASSWORD' && f.masked)).toBe(
      true,
    );
    expect(
      wp?.requiredFields.find((f) => f.envVar === 'WORDPRESS_APP_PASSWORD')?.value,
    ).toBeUndefined();
  });

  it('returns provider detail with required and optional fields', () => {
    const service = makeProviderConfigService();
    const detail = service.getConfig('wordpress');
    expect(detail?.displayName).toBeTruthy();
    expect(detail?.requiredFields.length).toBeGreaterThan(0);
    expect(detail?.supportsHotReload).toBe(true);
  });

  it('validates supplied configuration', () => {
    const service = makeProviderConfigService({ WORDPRESS_URL: '', WORDPRESS_USERNAME: '' });
    const result = service.validateConfig('wordpress', {
      WORDPRESS_URL: 'https://new.example.com',
      WORDPRESS_USERNAME: 'editor',
      WORDPRESS_APP_PASSWORD: 'abcd efgh ijkl mnop qrst uvwx',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid configuration on validate', () => {
    const service = makeProviderConfigService();
    const result = service.validateConfig('wordpress', { WORDPRESS_URL: 'not-a-url' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('updates configuration and preserves omitted secret fields', () => {
    const store = new ProviderConfigStore({ baseEnv: wordpressEnv });
    const service = createProviderConfigService({
      registry: createDefaultPublisherRegistry(),
      configStore: store,
    });

    const updated = service.updateConfig('wordpress', {
      WORDPRESS_URL: 'https://updated.example.com',
      WORDPRESS_APP_PASSWORD: '****mnop',
    });
    expect(updated && 'id' in updated).toBe(true);
    if (!updated || !('id' in updated)) return;

    const urlField = updated.requiredFields.find((f) => f.envVar === 'WORDPRESS_URL');
    expect(urlField?.value).toBe('https://updated.example.com');
    const secretField = updated.requiredFields.find((f) => f.envVar === 'WORDPRESS_APP_PASSWORD');
    expect(secretField?.masked).toBe('****uvwx');
    expect(secretField?.value).toBeUndefined();
  });

  it('returns validation result when update fails validation', () => {
    const service = makeProviderConfigService();
    const result = service.updateConfig('wordpress', { WORDPRESS_URL: 'bad-url' });
    expect(result && 'valid' in result && result.valid === false).toBe(true);
  });
});

describe('GET /providers/config', () => {
  it('returns provider configuration list', async () => {
    const app = buildApp({
      config: baseConfig,
      providerConfigService: makeProviderConfigService(),
    });
    const res = await app.inject({ method: 'GET', url: '/providers/config' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { providers: Array<{ id: string }>; count: number };
    expect(body.count).toBeGreaterThanOrEqual(2);
    expect(body.providers.some((p) => p.id === 'wordpress')).toBe(true);
  });

  it('returns 503 when service absent', async () => {
    const app = buildApp({ config: baseConfig });
    const res = await app.inject({ method: 'GET', url: '/providers/config' });
    expect(res.statusCode).toBe(503);
  });
});

describe('GET /providers/config/:providerId', () => {
  it('returns provider configuration detail', async () => {
    const app = buildApp({
      config: baseConfig,
      providerConfigService: makeProviderConfigService(),
    });
    const res = await app.inject({ method: 'GET', url: '/providers/config/wordpress' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string; requiredFields: unknown[] };
    expect(body.id).toBe('wordpress');
    expect(body.requiredFields.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown provider', async () => {
    const app = buildApp({
      config: baseConfig,
      providerConfigService: makeProviderConfigService(),
    });
    const res = await app.inject({ method: 'GET', url: '/providers/config/unknown' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /providers/config/:providerId/validate', () => {
  it('validates configuration without persisting', async () => {
    const app = buildApp({
      config: baseConfig,
      providerConfigService: makeProviderConfigService(),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/providers/config/wordpress/validate',
      payload: { WORDPRESS_URL: 'https://valid.example.com' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { valid: boolean };
    expect(body.valid).toBe(true);
  });
});

describe('PUT /providers/config/:providerId', () => {
  it('updates configuration after validation', async () => {
    const store = new ProviderConfigStore({ baseEnv: wordpressEnv });
    const service = createProviderConfigService({
      registry: createDefaultPublisherRegistry(),
      configStore: store,
    });
    const app = buildApp({ config: baseConfig, providerConfigService: service });

    const res = await app.inject({
      method: 'PUT',
      url: '/providers/config/wordpress',
      payload: {
        WORDPRESS_URL: 'https://saved.example.com',
        WORDPRESS_USERNAME: 'admin',
        WORDPRESS_APP_PASSWORD: 'abcd efgh ijkl mnop qrst uvwx',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { requiredFields: Array<{ envVar: string; value?: string }> };
    const url = body.requiredFields.find((f) => f.envVar === 'WORDPRESS_URL');
    expect(url?.value).toBe('https://saved.example.com');
  });

  it('returns 400 when validation fails', async () => {
    const app = buildApp({
      config: baseConfig,
      providerConfigService: makeProviderConfigService(),
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/providers/config/wordpress',
      payload: { WORDPRESS_URL: 'not-valid' },
    });
    expect(res.statusCode).toBe(400);
  });
});
