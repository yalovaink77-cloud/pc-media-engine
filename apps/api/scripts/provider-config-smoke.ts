/**
 * Provider configuration API smoke — Sprint 44.
 *
 * Offline — uses real ProviderConfigService with in-memory store.
 *
 * Run: pnpm --filter @pcme/api provider-config:smoke
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import { ProviderConfigStore } from '../src/providers/config-store.js';
import { createProviderConfigService } from '../src/providers/provider-config-service.js';
import {
  createDefaultPublisherRegistry,
  createPublisherService,
} from '../src/publishers/publisher-service.js';

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

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.44.0-smoke',
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
  WORDPRESS_URL: 'https://wp.smoke.test',
  WORDPRESS_USERNAME: 'admin',
  WORDPRESS_APP_PASSWORD: 'abcd efgh ijkl mnop qrst uvwx',
};

function makeServices(env: Record<string, string | undefined> = wordpressEnv) {
  const store = new ProviderConfigStore({ baseEnv: env });
  const registry = createDefaultPublisherRegistry();
  const providerConfigService = createProviderConfigService({ registry, configStore: store });
  const publisherService = createPublisherService({
    registry,
    getEnv: () => store.getMergedEnv(),
  });
  return { store, providerConfigService, publisherService };
}

async function main(): Promise<void> {
  const { providerConfigService, publisherService } = makeServices();
  const app = buildApp({ config: baseConfig, providerConfigService, publisherService });

  section('1 · Configuration read');
  const listRes = await app.inject({ method: 'GET', url: '/providers/config' });
  assert(listRes.statusCode === 200, 'GET /providers/config returns 200');
  const list = listRes.json() as { providers: Array<{ id: string; configured: boolean }> };
  assert(list.providers.length >= 2, 'lists registered providers');
  const wp = list.providers.find((p) => p.id === 'wordpress');
  assert(Boolean(wp?.configured), 'wordpress is configured');

  const detailRes = await app.inject({ method: 'GET', url: '/providers/config/wordpress' });
  assert(detailRes.statusCode === 200, 'GET /providers/config/:id returns 200');
  const detail = detailRes.json() as {
    requiredFields: Array<{ envVar: string; value?: string; masked?: string }>;
  };
  const secret = detail.requiredFields.find((f) => f.envVar === 'WORDPRESS_APP_PASSWORD');
  assert(Boolean(secret?.masked), 'secret field is masked');
  assert(secret?.value === undefined, 'secret value never exposed');

  section('2 · Validation');
  const validateRes = await app.inject({
    method: 'POST',
    url: '/providers/config/wordpress/validate',
    payload: {
      WORDPRESS_URL: 'https://valid.smoke.test',
      WORDPRESS_USERNAME: 'admin',
      WORDPRESS_APP_PASSWORD: 'abcd efgh ijkl mnop qrst uvwx',
    },
  });
  assert(validateRes.statusCode === 200, 'validate returns 200');
  const validation = validateRes.json() as { valid: boolean };
  assert(validation.valid === true, 'valid configuration accepted');

  const invalidRes = await app.inject({
    method: 'POST',
    url: '/providers/config/wordpress/validate',
    payload: { WORDPRESS_URL: 'not-a-url' },
  });
  const invalid = invalidRes.json() as { valid: boolean };
  assert(invalid.valid === false, 'invalid configuration rejected');

  section('3 · Update');
  const updateRes = await app.inject({
    method: 'PUT',
    url: '/providers/config/wordpress',
    payload: {
      WORDPRESS_URL: 'https://updated.smoke.test',
      WORDPRESS_USERNAME: 'admin',
      WORDPRESS_APP_PASSWORD: 'abcd efgh ijkl mnop qrst uvwx',
    },
  });
  assert(updateRes.statusCode === 200, 'PUT returns 200');
  const updated = updateRes.json() as {
    requiredFields: Array<{ envVar: string; value?: string }>;
  };
  const urlField = updated.requiredFields.find((f) => f.envVar === 'WORDPRESS_URL');
  assert(urlField?.value === 'https://updated.smoke.test', 'configuration persisted');

  section('4 · Secret masking on update');
  const preserveRes = await app.inject({
    method: 'PUT',
    url: '/providers/config/wordpress',
    payload: {
      WORDPRESS_URL: 'https://preserved.smoke.test',
      WORDPRESS_APP_PASSWORD: '****uvwx',
    },
  });
  assert(preserveRes.statusCode === 200, 'masked secret update returns 200');
  const preserved = preserveRes.json() as {
    requiredFields: Array<{ envVar: string; masked?: string; value?: string }>;
  };
  const preservedSecret = preserved.requiredFields.find(
    (f) => f.envVar === 'WORDPRESS_APP_PASSWORD',
  );
  assert(Boolean(preservedSecret?.masked), 'secret still masked after update');
  assert(preservedSecret?.value === undefined, 'secret value still hidden');

  section('5 · Health endpoint still available');
  const healthRes = await app.inject({ method: 'GET', url: '/publishers/wordpress/health' });
  assert(healthRes.statusCode === 200, 'health endpoint reachable');

  console.log('\n✅  All provider configuration API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
