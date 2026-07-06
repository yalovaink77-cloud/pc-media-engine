/**
 * Ghost provider smoke script — Sprint 35.
 *
 * Offline only — uses fake Ghost Admin API responses.
 *
 * Run: pnpm ghost:smoke
 */

import { isPublisherProvider, PublisherRegistry } from '@pcme/publisher-sdk';

import { buildGhostAuthHeader, createGhostJwt } from '../auth.js';
import {
  isValidGhostAdminApiKey,
  isValidGhostUrl,
  loadGhostConfig,
  validateGhostConfigStrict,
} from '../config.js';
import { categorizeHttpStatus, GhostApiError, isRetryableError } from '../errors.js';
import type { FetchFunction } from '../ghost.publisher.js';
import { GhostPublisher } from '../ghost.publisher.js';
import { ghostRegistration } from '../registration.js';

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

const FAKE_BASE = 'https://fake-ghost.example.com';
const FAKE_KEY =
  '633c86459f984d202ff980e9e1:8d3c5e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e';

const FAKE_CONFIG = {
  baseUrl: FAKE_BASE,
  adminApiKey: FAKE_KEY,
  requestTimeoutMs: 30_000,
};

function fakeGhostServer(authenticated = true): FetchFunction {
  return async (url, init) => {
    const urlStr = String(url);
    if (!authenticated) {
      return new Response(
        JSON.stringify({ errors: [{ message: 'Invalid token', type: 'UnauthorizedError' }] }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (urlStr.includes('/ghost/api/admin/site')) {
      return new Response(JSON.stringify({ site: { title: 'Smoke Blog', url: FAKE_BASE } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (urlStr.includes('/ghost/api/admin/images/upload')) {
      return new Response(
        JSON.stringify({ images: [{ url: `${FAKE_BASE}/content/images/smoke.jpg` }] }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (urlStr.includes('/ghost/api/admin/posts')) {
      const body = JSON.parse(String(init?.body)) as { posts: Array<Record<string, unknown>> };
      const post = body.posts[0]!;
      return new Response(
        JSON.stringify({
          posts: [
            {
              id: 'smoke-post-1',
              url: `${FAKE_BASE}/${post['slug']}/`,
              slug: post['slug'],
              status: 'draft',
              created_at: '2024-06-01T12:00:00.000Z',
            },
          ],
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response('Not Found', { status: 404 });
  };
}

async function main(): Promise<void> {
  section('1 · Configuration');
  {
    const cfg = loadGhostConfig({ GHOST_URL: `${FAKE_BASE}/`, GHOST_ADMIN_API_KEY: FAKE_KEY });
    assert(cfg.baseUrl === FAKE_BASE, 'baseUrl loaded');
    assert(isValidGhostUrl(FAKE_BASE), 'valid URL');
    assert(isValidGhostAdminApiKey(FAKE_KEY), 'valid API key format');

    let threw = false;
    try {
      loadGhostConfig({ GHOST_URL: 'bad', GHOST_ADMIN_API_KEY: FAKE_KEY });
    } catch {
      threw = true;
    }
    assert(threw, 'invalid URL rejected');

    const strict = validateGhostConfigStrict(cfg);
    assert(strict.errors.length === 0, 'strict validation passes');
  }

  section('2 · JWT authentication');
  {
    const jwt = createGhostJwt(FAKE_KEY, 1_700_000_000);
    assert(jwt.split('.').length === 3, 'JWT has 3 parts');
    assert(buildGhostAuthHeader(FAKE_KEY).startsWith('Ghost '), 'auth header format');
  }

  section('3 · Error categorization');
  {
    assert(categorizeHttpStatus(401) === 'auth', '401 → auth');
    assert(categorizeHttpStatus(429) === 'rate_limit', '429 → rate_limit');
    assert(isRetryableError(new GhostApiError(500, 'err', 'boom')), '500 retryable');
    assert(!isRetryableError(new GhostApiError(401, 'auth', 'no')), '401 not retryable');
  }

  section('4 · health()');
  {
    const pub = new GhostPublisher(FAKE_CONFIG, fakeGhostServer());
    const result = await pub.health();
    assert(result.status === 'ok', `health ok (got ${result.status})`);
  }

  section('5 · publishMedia()');
  {
    const pub = new GhostPublisher(FAKE_CONFIG, fakeGhostServer());
    const result = await pub.publishMedia({
      title: 'Smoke Image',
      slug: 'smoke-image',
      mediaMimeType: 'image/jpeg',
      mediaBuffer: Buffer.from('fake-jpeg'),
    });
    assert(result.success, 'media upload success');
    assert(result.url.includes('/content/images/'), 'image URL returned');
  }

  section('6 · publishPost() — HTML draft with tags and feature image');
  {
    const pub = new GhostPublisher(FAKE_CONFIG, fakeGhostServer());
    const result = await pub.publishPost({
      title: 'Smoke Post',
      slug: 'smoke-post',
      body: '<p>Smoke HTML content.</p>',
      tags: ['smoke', 'test'],
      featuredAssetId: `${FAKE_BASE}/content/images/feature.jpg`,
    });
    assert(result.success, 'post creation success');
    assert(result.postStatus === 'draft', `status=draft (got ${result.postStatus})`);
    assert(result.permalink?.includes('/smoke-post/'), 'permalink present');
  }

  section('7 · PublisherProvider introspection');
  {
    const pub = new GhostPublisher(FAKE_CONFIG, fakeGhostServer());
    assert(isPublisherProvider(pub), 'passes type guard');
    assert(pub.getMetadata().id === 'ghost', 'metadata id=ghost');
    assert(pub.getCapabilities().drafts === true, 'drafts capability');
    assert(pub.getCapabilities().tags === true, 'tags capability');
    assert(pub.getCapabilities().featuredImages === true, 'featuredImages capability');
  }

  section('8 · Registry integration');
  {
    const registry = new PublisherRegistry();
    registry.register(ghostRegistration);
    assert(registry.has('ghost'), 'ghost registered');
    const provider = registry.create('ghost', FAKE_CONFIG);
    assert(provider.getMetadata().name === 'Ghost', 'registry creates provider');
  }

  section('9 · Error path — 401');
  {
    const pub = new GhostPublisher(FAKE_CONFIG, fakeGhostServer(false));
    let caught: GhostApiError | undefined;
    try {
      await pub.publishPost({ title: 'T', slug: 't', body: '<p>x</p>' });
    } catch (e) {
      if (e instanceof GhostApiError) caught = e;
    }
    assert(caught?.category === 'auth', '401 mapped to auth');
  }

  console.log('\n✅  All Ghost provider smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Ghost smoke failed:', err);
  process.exit(1);
});
