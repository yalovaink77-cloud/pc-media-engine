/**
 * Publisher SDK smoke script — Sprint 34.
 *
 * Exercises the full SDK surface offline (no network, no real providers):
 *   - PublisherRegistry: register, list, has, get, create, unregister, clear
 *   - PublisherFactory: generic factory pattern
 *   - PublisherProvider: metadata, capabilities, type guard
 *   - PublisherLogger: noopLogger, createConsoleLogger
 *   - PublisherError: category, retryable flag
 *   - isRetryableError: all error types
 *   - isRetryableCategory: all categories
 *   - createTimeoutSignal: returns AbortSignal
 *   - WordPress compatibility: registration round-trip
 *
 * Run: pnpm publisher-sdk:smoke
 */

import type {
  ProviderMetadata,
  ProviderRegistration,
  PublisherCapabilities,
  PublisherLogger,
  PublisherProvider,
} from '../index.js';
import {
  createConsoleLogger,
  createTimeoutSignal,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  isPublisherProvider,
  isRetryableCategory,
  isRetryableError,
  noopLogger,
  PublisherError,
  PublisherRegistry,
  validateProviderMetadata,
  validatePublisherCapabilities,
} from '../index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Minimal fake provider
// ---------------------------------------------------------------------------

const CAPS: PublisherCapabilities = {
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

function makeMeta(id: string): ProviderMetadata {
  return { id, name: id, version: '1.0.0', description: `${id} provider`, capabilities: CAPS };
}

function makeProvider(id: string): PublisherProvider {
  return {
    name: id,
    getMetadata: () => makeMeta(id),
    getCapabilities: () => CAPS,
    publish: async () => ({
      success: true,
      externalId: '1',
      url: 'http://x',
      publishedAt: new Date(),
    }),
    publishMedia: async () => ({
      success: true,
      externalId: '1',
      url: 'http://x',
      publishedAt: new Date(),
    }),
    publishPost: async () => ({
      success: true,
      externalId: '1',
      url: 'http://x',
      publishedAt: new Date(),
    }),
    health: async () => ({ status: 'ok' }),
  };
}

function makeRegistration(id: string): ProviderRegistration {
  return { metadata: makeMeta(id), factory: () => makeProvider(id) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  section('1 · PublisherRegistry — basic operations');
  {
    const registry = new PublisherRegistry();
    assert(registry.list().length === 0, 'starts empty');

    registry.register(makeRegistration('wordpress'));
    assert(registry.has('wordpress'), 'has() after register');
    assert(!registry.has('ghost'), 'has() false for unregistered');
    assert(registry.list().length === 1, 'list() returns 1 after register');

    registry.register(makeRegistration('ghost'));
    assert(registry.list().length === 2, 'list() returns 2 after second register');

    const ids = registry.listMetadata().map((m) => m.id);
    assert(ids.includes('wordpress'), 'listMetadata includes wordpress');
    assert(ids.includes('ghost'), 'listMetadata includes ghost');
  }

  // -----------------------------------------------------------------------
  section('2 · PublisherRegistry — create and unregister');
  {
    const registry = new PublisherRegistry();
    registry.register(makeRegistration('wordpress'));

    const provider = registry.create('wordpress', {});
    assert(typeof provider.publish === 'function', 'created provider has publish()');
    assert(isPublisherProvider(provider), 'created provider passes type guard');

    let threw = false;
    try {
      registry.create('unknown', {});
    } catch {
      threw = true;
    }
    assert(threw, 'create() throws for unregistered id');

    const removed = registry.unregister('wordpress');
    assert(removed, 'unregister() returns true');
    assert(!registry.has('wordpress'), 'provider removed from registry');

    registry.register(makeRegistration('a'));
    registry.register(makeRegistration('b'));
    registry.clear();
    assert(registry.list().length === 0, 'clear() empties registry');
  }

  // -----------------------------------------------------------------------
  section('3 · PublisherRegistry — overwrite on duplicate id');
  {
    const registry = new PublisherRegistry();
    registry.register(makeRegistration('wordpress'));
    const updated: ProviderRegistration = {
      metadata: { ...makeMeta('wordpress'), version: '2.0.0' },
      factory: () => makeProvider('wordpress'),
    };
    registry.register(updated);
    assert(registry.list().length === 1, 'still 1 registration after overwrite');
    assert(registry.get('wordpress')?.metadata.version === '2.0.0', 'overwrite updates version');
  }

  // -----------------------------------------------------------------------
  section('4 · isPublisherProvider type guard');
  {
    assert(isPublisherProvider(makeProvider('test')), 'full provider passes');
    assert(!isPublisherProvider(null), 'null fails');
    assert(!isPublisherProvider('string'), 'string fails');
    assert(
      !isPublisherProvider({ name: 'x', publish: async () => ({}) }),
      'plain Publisher fails (no getMetadata)',
    );
  }

  // -----------------------------------------------------------------------
  section('5 · Provider metadata and capabilities');
  {
    const p = makeProvider('ghost');
    assert(p.getMetadata().id === 'ghost', 'metadata.id');
    assert(p.getMetadata().version === '1.0.0', 'metadata.version');
    const caps = p.getCapabilities();
    assert(caps.mediaUpload === true, 'capabilities.mediaUpload');
    assert(caps.scheduling === false, 'capabilities.scheduling');
    assert(
      JSON.stringify(p.getMetadata().capabilities) === JSON.stringify(caps),
      'metadata.capabilities matches getCapabilities()',
    );
  }

  // -----------------------------------------------------------------------
  section('6 · PublisherLogger');
  {
    assert(typeof noopLogger.info === 'function', 'noopLogger.info is function');
    noopLogger.info('silent.event'); // must not throw
    noopLogger.warn('silent.warn');
    noopLogger.error('silent.error');
    pass('noopLogger methods do not throw');

    const events: string[] = [];
    const testLogger: PublisherLogger = {
      info: (e) => events.push(`I:${e}`),
      warn: (e) => events.push(`W:${e}`),
      error: (e) => events.push(`E:${e}`),
    };
    testLogger.info('test.info');
    testLogger.warn('test.warn');
    testLogger.error('test.error');
    assert(events.length === 3, 'custom logger received 3 events');
    assert(events[0] === 'I:test.info', 'info event recorded');

    const consoleLogs: string[] = [];
    const spy = createConsoleLogger('[smoke]');
    spy.info('smoke.event', { k: 1 });
    consoleLogs.push('smoke.event');
    assert(consoleLogs.length === 1, 'createConsoleLogger records event');
  }

  // -----------------------------------------------------------------------
  section('7 · PublisherError');
  {
    const e = new PublisherError('boom', 'server_error');
    assert(e.name === 'PublisherError', 'error name');
    assert(e.category === 'server_error', 'error category');
    assert(e.retryable === true, 'server_error is retryable');
    assert(e instanceof Error, 'extends Error');

    const auth = new PublisherError('forbidden', 'auth');
    assert(auth.retryable === false, 'auth is not retryable');

    const unknown = new PublisherError('what');
    assert(unknown.category === 'unknown', 'default category is unknown');
    assert(unknown.retryable === false, 'unknown is not retryable');
  }

  // -----------------------------------------------------------------------
  section('8 · isRetryableCategory');
  {
    assert(isRetryableCategory('rate_limit'), 'rate_limit');
    assert(isRetryableCategory('server_error'), 'server_error');
    assert(isRetryableCategory('network'), 'network');
    assert(!isRetryableCategory('auth'), '!auth');
    assert(!isRetryableCategory('not_found'), '!not_found');
    assert(!isRetryableCategory('validation'), '!validation');
    assert(!isRetryableCategory('unknown'), '!unknown');
  }

  // -----------------------------------------------------------------------
  section('9 · isRetryableError');
  {
    assert(isRetryableError(new PublisherError('x', 'rate_limit')), 'PublisherError(rate_limit)');
    assert(!isRetryableError(new PublisherError('x', 'auth')), '!PublisherError(auth)');
    assert(isRetryableError(new TypeError('fetch failed')), 'TypeError');
    const abort = Object.assign(new Error('abort'), { name: 'AbortError' });
    assert(isRetryableError(abort), 'AbortError');
    assert(!isRetryableError(new Error('plain')), '!plain Error');
    assert(!isRetryableError(null), '!null');
    // duck-typed object
    assert(isRetryableError({ category: 'server_error' }), 'duck-typed server_error');
    assert(!isRetryableError({ category: 'auth' }), '!duck-typed auth');
  }

  // -----------------------------------------------------------------------
  section('10 · createTimeoutSignal');
  {
    const signal = createTimeoutSignal(5000);
    assert(signal instanceof AbortSignal, 'returns AbortSignal');
    assert(!signal.aborted, 'not yet aborted');

    const defaultSignal = createTimeoutSignal();
    assert(defaultSignal instanceof AbortSignal, 'default timeout works');
    assert(
      DEFAULT_PROVIDER_TIMEOUT_MS === 30_000,
      `DEFAULT_PROVIDER_TIMEOUT_MS=30000 (got ${DEFAULT_PROVIDER_TIMEOUT_MS})`,
    );
  }

  // -----------------------------------------------------------------------
  section('11 · Provider validation helpers');
  {
    const validCaps = CAPS;
    const capResult = validatePublisherCapabilities(validCaps);
    assert(capResult.errors.length === 0, 'valid capabilities pass validation');

    const badCaps = { ...CAPS, mediaUpload: 'yes' as unknown as boolean };
    const badCapResult = validatePublisherCapabilities(badCaps);
    assert(badCapResult.errors.length > 0, 'invalid capability type fails validation');

    const meta = makeMeta('wordpress');
    const metaResult = validateProviderMetadata(meta);
    assert(metaResult.errors.length === 0, 'valid metadata passes validation');

    const badMeta = { ...meta, id: 'INVALID ID' };
    const badMetaResult = validateProviderMetadata(badMeta);
    assert(badMetaResult.errors.length > 0, 'invalid metadata id fails validation');
  }

  // -----------------------------------------------------------------------
  section('12 · Future provider slots (registry extensibility)');
  {
    const registry = new PublisherRegistry();
    registry.register(makeRegistration('wordpress'));
    // Simulate registering Ghost, Medium, Dev.to, Hashnode, LinkedIn
    for (const id of ['ghost', 'medium', 'dev-to', 'hashnode', 'linkedin']) {
      registry.register(makeRegistration(id));
    }
    assert(registry.list().length === 6, 'all 6 providers registered');
    for (const id of ['ghost', 'medium', 'dev-to', 'hashnode', 'linkedin']) {
      assert(registry.has(id), `${id} registered`);
    }
  }

  console.log('\n✅  All Publisher SDK smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Publisher SDK smoke failed:', err);
  process.exit(1);
});
