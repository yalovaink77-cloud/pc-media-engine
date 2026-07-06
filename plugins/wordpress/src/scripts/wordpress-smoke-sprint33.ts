/**
 * Sprint 33 WordPress production hardening smoke script.
 *
 * Exercises all Sprint 33 additions:
 *   - WORDPRESS_URL env var alias
 *   - requestTimeoutMs config field
 *   - URL format validation
 *   - validateWordPressConfigStrict
 *   - Error categorization (auth, rate_limit, server_error)
 *   - isRetryableError
 *   - MIME type allowlist validation
 *   - Media size limit validation
 *   - URL-safe slug validation
 *   - Enhanced publishMedia result (wpMediaId, permalink)
 *   - Enhanced publishPost result (wpPostId, postStatus, permalink)
 *   - Logger injection
 *
 * No real WordPress — offline only.
 *
 * Run:  pnpm wordpress:smoke
 */

import {
  isValidWordPressUrl,
  loadWordPressConfig,
  validateWordPressConfigStrict,
  WordPressConfigError,
} from '../config.js';
import { categorizeHttpStatus, isRetryableError, WordPressApiError } from '../errors.js';
import { createConsoleLogger } from '../logger.js';
import { validateMediaRequest, validatePostRequest } from '../validator.js';
import type { FetchFunction } from '../wordpress-media.publisher.js';
import { WordPressMediaPublisher } from '../wordpress-media.publisher.js';

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
// Fake WordPress server
// ---------------------------------------------------------------------------

const FAKE_MEDIA_ID = 1337;
const FAKE_POST_ID = 2048;
const FAKE_BASE = 'https://fake-wp.example.com';

function fakeServer(authenticated = true): FetchFunction {
  return async (url, init) => {
    const urlStr = String(url);
    if (!authenticated) {
      return new Response(
        JSON.stringify({ code: 'rest_not_logged_in', message: 'Not logged in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (urlStr.includes('/wp-json/wp/v2/users/me')) {
      return new Response(JSON.stringify({ id: 1, name: 'smoke-admin' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/wp-json/wp/v2/media')) {
      return new Response(
        JSON.stringify({
          id: FAKE_MEDIA_ID,
          link: `${FAKE_BASE}/?attachment_id=${FAKE_MEDIA_ID}`,
          source_url: `${FAKE_BASE}/wp-content/uploads/smoke.jpg`,
          date: '2024-06-01T12:00:00',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (urlStr.includes('/wp-json/wp/v2/posts') && (init?.method === 'POST' || !init?.method)) {
      return new Response(
        JSON.stringify({
          id: FAKE_POST_ID,
          link: `${FAKE_BASE}/?p=${FAKE_POST_ID}`,
          date: '2024-06-02T12:00:00',
          status: 'draft',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response('Not Found', { status: 404 });
  };
}

function rateLimit429Server(): FetchFunction {
  return async () =>
    new Response(JSON.stringify({ code: 'too_many_requests', message: 'Slow down.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
}

function serverError500(): FetchFunction {
  return async () =>
    new Response(JSON.stringify({ code: 'internal_error', message: 'Something broke.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
}

const FAKE_CONFIG = {
  baseUrl: FAKE_BASE,
  username: 'smoke-admin',
  appPassword: 'fake xxxx yyyy zzzz',
  requestTimeoutMs: 30_000,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  section('1 · WORDPRESS_URL env var alias');
  {
    const cfg = loadWordPressConfig({
      WORDPRESS_URL: `${FAKE_BASE}/`,
      WORDPRESS_USERNAME: 'u',
      WORDPRESS_APP_PASSWORD: 'p',
    });
    assert(cfg.baseUrl === FAKE_BASE, `baseUrl loaded from WORDPRESS_URL (got ${cfg.baseUrl})`);
    assert(
      cfg.requestTimeoutMs === 30_000,
      `default requestTimeoutMs=30000 (got ${cfg.requestTimeoutMs})`,
    );
  }

  // -----------------------------------------------------------------------
  section('2 · requestTimeoutMs from env');
  {
    const cfg = loadWordPressConfig({
      WORDPRESS_URL: FAKE_BASE,
      WORDPRESS_USERNAME: 'u',
      WORDPRESS_APP_PASSWORD: 'p',
      WORDPRESS_REQUEST_TIMEOUT_MS: '60000',
    });
    assert(cfg.requestTimeoutMs === 60_000, `requestTimeoutMs=60000 (got ${cfg.requestTimeoutMs})`);
  }

  // -----------------------------------------------------------------------
  section('3 · URL format validation');
  {
    assert(isValidWordPressUrl('https://example.com'), 'https URL is valid');
    assert(isValidWordPressUrl('http://localhost:8080'), 'http localhost is valid');
    assert(!isValidWordPressUrl('not-a-url'), 'bare hostname is invalid');
    assert(!isValidWordPressUrl(''), 'empty string is invalid');

    let threw = false;
    try {
      loadWordPressConfig({
        WORDPRESS_URL: 'not-valid',
        WORDPRESS_USERNAME: 'u',
        WORDPRESS_APP_PASSWORD: 'p',
      });
    } catch (e) {
      if (e instanceof WordPressConfigError) threw = true;
    }
    assert(threw, 'loadWordPressConfig throws for invalid URL');
  }

  // -----------------------------------------------------------------------
  section('4 · validateWordPressConfigStrict');
  {
    const good = validateWordPressConfigStrict(FAKE_CONFIG);
    assert(good.errors.length === 0, 'no errors for valid config');

    const httpWarn = validateWordPressConfigStrict({
      ...FAKE_CONFIG,
      baseUrl: 'http://example.com',
    });
    assert(httpWarn.errors.length === 0, 'HTTP URL not an error');
    assert(
      httpWarn.warnings.some((w) => w.includes('HTTP')),
      'HTTP URL emits warning',
    );

    const noPass = validateWordPressConfigStrict({ ...FAKE_CONFIG, appPassword: '' });
    assert(
      noPass.errors.some((e) => e.includes('appPassword')),
      'empty appPassword is an error',
    );
  }

  // -----------------------------------------------------------------------
  section('5 · Error categorization');
  {
    assert(categorizeHttpStatus(401) === 'auth', '401 → auth');
    assert(categorizeHttpStatus(403) === 'auth', '403 → auth');
    assert(categorizeHttpStatus(429) === 'rate_limit', '429 → rate_limit');
    assert(categorizeHttpStatus(500) === 'server_error', '500 → server_error');
    assert(categorizeHttpStatus(404) === 'not_found', '404 → not_found');
    assert(categorizeHttpStatus(400) === 'validation', '400 → validation');
  }

  // -----------------------------------------------------------------------
  section('6 · isRetryableError');
  {
    assert(isRetryableError(new WordPressApiError(429, 'rate', 'slow')), '429 is retryable');
    assert(isRetryableError(new WordPressApiError(500, 'err', 'boom')), '500 is retryable');
    assert(!isRetryableError(new WordPressApiError(401, 'auth', 'no')), '401 not retryable');
    assert(!isRetryableError(new WordPressApiError(404, 'nf', 'gone')), '404 not retryable');
    assert(isRetryableError(new TypeError('fetch failed')), 'TypeError is retryable');
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    assert(isRetryableError(abort), 'AbortError is retryable');
  }

  // -----------------------------------------------------------------------
  section('7 · Media validator — MIME allowlist');
  {
    const base = { title: 'T', slug: 'slug', mediaBuffer: Buffer.from('bytes') };
    let threw = false;
    try {
      validateMediaRequest({ ...base, mediaMimeType: 'text/html' });
    } catch {
      threw = true;
    }
    assert(threw, 'text/html rejected');

    let ok = false;
    try {
      validateMediaRequest({ ...base, mediaMimeType: 'image/jpeg' });
      ok = true;
    } catch {
      /* expected to pass */
    }
    assert(ok, 'image/jpeg accepted');
  }

  // -----------------------------------------------------------------------
  section('8 · Media validator — size limit');
  {
    const oversized = Buffer.alloc(51 * 1024 * 1024);
    let threw = false;
    try {
      validateMediaRequest({
        title: 'T',
        slug: 'slug',
        mediaMimeType: 'image/jpeg',
        mediaBuffer: oversized,
      });
    } catch {
      threw = true;
    }
    assert(threw, '51 MB buffer rejected');
  }

  // -----------------------------------------------------------------------
  section('9 · Post validator — URL-safe slug');
  {
    let threw = false;
    try {
      validatePostRequest({ title: 'T', slug: 'BAD SLUG!', body: '<p>body</p>' });
    } catch {
      threw = true;
    }
    assert(threw, 'non-URL-safe slug rejected');

    let ok = false;
    try {
      validatePostRequest({ title: 'T', slug: 'good-slug-123', body: '<p>body</p>' });
      ok = true;
    } catch {
      /* expected to pass */
    }
    assert(ok, 'good slug accepted');
  }

  // -----------------------------------------------------------------------
  section('10 · publishMedia — enhanced result fields');
  {
    const pub = new WordPressMediaPublisher(FAKE_CONFIG, fakeServer());
    const result = await pub.publishMedia({
      title: 'Photo',
      slug: 'photo',
      mediaMimeType: 'image/jpeg',
      mediaBuffer: Buffer.from('fake'),
    });
    assert(result.success, 'success=true');
    assert(
      result.wpMediaId === FAKE_MEDIA_ID,
      `wpMediaId=${FAKE_MEDIA_ID} (got ${result.wpMediaId})`,
    );
    assert(
      typeof result.permalink === 'string' && result.permalink.length > 0,
      'permalink present',
    );
  }

  // -----------------------------------------------------------------------
  section('11 · publishPost — enhanced result fields');
  {
    const pub = new WordPressMediaPublisher(FAKE_CONFIG, fakeServer());
    const result = await pub.publishPost({
      title: 'Guide',
      slug: 'guide',
      body: '<p>Content</p>',
    });
    assert(result.success, 'success=true');
    assert(result.wpPostId === FAKE_POST_ID, `wpPostId=${FAKE_POST_ID} (got ${result.wpPostId})`);
    assert(result.postStatus === 'draft', `postStatus=draft (got ${result.postStatus})`);
    assert(
      typeof result.permalink === 'string' && result.permalink.length > 0,
      'permalink present',
    );
  }

  // -----------------------------------------------------------------------
  section('12 · Logger injection — info events emitted');
  {
    const events: string[] = [];
    const logger = {
      info: (e: string) => events.push(e),
      warn: (_e: string) => undefined,
      error: (_e: string) => undefined,
    };
    const pub = new WordPressMediaPublisher(FAKE_CONFIG, fakeServer(), { logger });
    await pub.publishMedia({
      title: 'T',
      slug: 'photo',
      mediaMimeType: 'image/jpeg',
      mediaBuffer: Buffer.from('fake'),
    });
    assert(
      events.some((e) => e.includes('upload')),
      'upload event logged',
    );
    assert(
      events.some((e) => e.includes('success')),
      'success event logged',
    );
  }

  // -----------------------------------------------------------------------
  section('13 · Error category on rate limit (429)');
  {
    const pub = new WordPressMediaPublisher(FAKE_CONFIG, rateLimit429Server());
    let caught: WordPressApiError | undefined;
    try {
      await pub.publishMedia({
        title: 'T',
        slug: 'photo',
        mediaMimeType: 'image/jpeg',
        mediaBuffer: Buffer.from('fake'),
      });
    } catch (e) {
      if (e instanceof WordPressApiError) caught = e;
    }
    assert(caught !== undefined, 'WordPressApiError thrown');
    assert(caught?.category === 'rate_limit', `category=rate_limit (got ${caught?.category})`);
    assert(isRetryableError(caught), '429 error is retryable');
  }

  // -----------------------------------------------------------------------
  section('14 · Error category on server error (500)');
  {
    const pub = new WordPressMediaPublisher(FAKE_CONFIG, serverError500());
    let caught: WordPressApiError | undefined;
    try {
      await pub.publishPost({ title: 'T', slug: 'guide', body: '<p>Content</p>' });
    } catch (e) {
      if (e instanceof WordPressApiError) caught = e;
    }
    assert(caught?.category === 'server_error', `category=server_error (got ${caught?.category})`);
    assert(isRetryableError(caught), '500 error is retryable');
  }

  // -----------------------------------------------------------------------
  section('15 · createConsoleLogger does not throw');
  {
    const logger = createConsoleLogger('[smoke]');
    logger.info('test info event', { key: 'value' });
    logger.warn('test warn event');
    logger.error('test error event');
    pass('createConsoleLogger works without throwing');
  }

  // -----------------------------------------------------------------------
  section('16 · health() logs check event');
  {
    const events: string[] = [];
    const logger = {
      info: (e: string) => events.push(e),
      warn: (_e: string) => undefined,
      error: (_e: string) => undefined,
    };
    const pub = new WordPressMediaPublisher(FAKE_CONFIG, fakeServer(), { logger });
    const result = await pub.health();
    assert(result.status === 'ok', `health ok (got ${result.status})`);
    assert(
      events.some((e) => e.includes('health')),
      'health event logged',
    );
  }

  console.log('\n✅  All Sprint 33 WordPress smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('WordPress smoke failed:', err);
  process.exit(1);
});
