/**
 * WordPress plugin smoke script — Sprint 14.
 *
 * Verifies the WordPressMediaPublisher end-to-end using a fake in-process
 * HTTP implementation. No real WordPress credentials are required.
 *
 * The fake simulates a WordPress REST API server that:
 *   - Responds 200 to GET  /wp-json/wp/v2/users/me  (health check)
 *   - Responds 201 to POST /wp-json/wp/v2/media     (media upload)
 *   - Responds 401 to any request with bad credentials (error path test)
 *
 * Real WordPress smoke (opt-in):
 *   Set WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD
 *   then run: WP_REAL_SMOKE=1 pnpm --filter @pcme/plugin-wordpress smoke
 *
 * Run:
 *   pnpm --filter @pcme/plugin-wordpress smoke
 */

import type { Publisher } from '@pcme/publishing';

import type { WordPressConfig } from '../config.js';
import { loadWordPressConfig, WordPressConfigError } from '../config.js';
import { WordPressApiError } from '../errors.js';
import type { FetchFunction } from '../wordpress-media.publisher.js';
import { WordPressMediaPublisher } from '../wordpress-media.publisher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(msg: string): void {
  process.stdout.write(`  ✓ ${msg}\n`);
}

function section(title: string): void {
  process.stdout.write(`\n▶ ${title}\n`);
}

function fail(msg: string, err?: unknown): never {
  process.stderr.write(`\n✗ SMOKE FAILED: ${msg}\n`);
  if (err instanceof Error) process.stderr.write(`  ${err.message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fake HTTP implementation (no network required)
// ---------------------------------------------------------------------------

const FAKE_BASE_URL = 'https://fake-wp.example.com';
const FAKE_ATTACHMENT_ID = 1337;
const FAKE_SOURCE_URL = `${FAKE_BASE_URL}/wp-content/uploads/smoke-photo.jpg`;
const FAKE_USER_NAME = 'smoke-admin';

function fakeWpServer(goodCredentials: boolean): FetchFunction {
  return async (url) => {
    const urlStr = String(url);

    if (!goodCredentials) {
      return new Response(
        JSON.stringify({ code: 'rest_not_logged_in', message: 'You are not currently logged in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (urlStr.includes('/wp-json/wp/v2/users/me')) {
      return new Response(JSON.stringify({ id: 1, name: FAKE_USER_NAME }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (urlStr.includes('/wp-json/wp/v2/media')) {
      return new Response(
        JSON.stringify({
          id: FAKE_ATTACHMENT_ID,
          link: `${FAKE_BASE_URL}/?attachment_id=${FAKE_ATTACHMENT_ID}`,
          source_url: FAKE_SOURCE_URL,
          date: '2024-06-01T12:00:00',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response('Not Found', { status: 404 });
  };
}

const FAKE_CONFIG: WordPressConfig = {
  baseUrl: FAKE_BASE_URL,
  username: 'smoke-admin',
  appPassword: 'fake xxxx yyyy zzzz',
};

// ---------------------------------------------------------------------------
// Smoke
// ---------------------------------------------------------------------------

async function smoke(): Promise<void> {
  process.stdout.write('═══ Sprint 14 WordPress Media Upload Smoke ═══\n');

  // -------------------------------------------------------------------------
  // Step 1 — Fake health check (ok path)
  // -------------------------------------------------------------------------
  section('Step 1 — health() — ok path (fake HTTP)');

  const publisherOk: Publisher = new WordPressMediaPublisher(FAKE_CONFIG, fakeWpServer(true));
  const healthOk = await publisherOk.health();
  if (healthOk.status !== 'ok') fail(`Expected status=ok, got ${healthOk.status}`);
  ok(`health().status = ${healthOk.status}`);
  ok(`health().message = ${healthOk.message ?? '(none)'}`);

  // -------------------------------------------------------------------------
  // Step 2 — Fake health check (down path: 401 from WP)
  // -------------------------------------------------------------------------
  section('Step 2 — health() — down path (401 from fake WordPress)');

  const publisherBadCreds: Publisher = new WordPressMediaPublisher(
    FAKE_CONFIG,
    fakeWpServer(false),
  );
  const healthDown = await publisherBadCreds.health();
  if (healthDown.status !== 'down') fail(`Expected status=down, got ${healthDown.status}`);
  ok(`health().status = ${healthDown.status}`);

  // -------------------------------------------------------------------------
  // Step 3 — health() with incomplete config
  // -------------------------------------------------------------------------
  section('Step 3 — health() — down path (incomplete config)');

  const publisherBadConfig = new WordPressMediaPublisher(
    { baseUrl: '', username: '', appPassword: '' },
    fakeWpServer(true),
  );
  const healthNoConfig = await publisherBadConfig.health();
  if (healthNoConfig.status !== 'down') {
    fail(`Expected status=down for empty config, got ${healthNoConfig.status}`);
  }
  ok(`health().status = ${healthNoConfig.status} (config missing)`);

  // -------------------------------------------------------------------------
  // Step 4 — publishMedia (success path)
  // -------------------------------------------------------------------------
  section('Step 4 — publishMedia() — success path (fake HTTP)');

  const imageBuffer = Buffer.from(
    // Minimal 1×1 red JPEG bytes (not a real image, but non-empty)
    'fake-jpeg-content-for-smoke',
    'utf8',
  );

  const result = await publisherOk.publishMedia({
    title: 'Industrial Barbell — Product Shot',
    slug: 'industrial-barbell-product-shot',
    mediaBuffer: imageBuffer,
    mediaMimeType: 'image/jpeg',
    mediaFilename: 'smoke-photo.jpg',
  });

  if (!result.success) fail('publishMedia returned success=false');
  ok(`success = ${result.success}`);

  if (result.externalId !== String(FAKE_ATTACHMENT_ID)) {
    fail(`Expected externalId=${FAKE_ATTACHMENT_ID}, got ${result.externalId}`);
  }
  ok(`externalId = ${result.externalId}`);

  if (result.url !== FAKE_SOURCE_URL) {
    fail(`Expected url=${FAKE_SOURCE_URL}, got ${result.url}`);
  }
  ok(`url = ${result.url}`);

  if (!(result.publishedAt instanceof Date)) fail('publishedAt is not a Date');
  ok(`publishedAt = ${result.publishedAt.toISOString()}`);

  ok(`message = ${result.message ?? '(none)'}`);

  // -------------------------------------------------------------------------
  // Step 5 — publishMedia error path (WordPress returns 401)
  // -------------------------------------------------------------------------
  section('Step 5 — publishMedia() — error path (401 from fake WordPress)');

  let caughtApiError = false;
  try {
    await publisherBadCreds.publishMedia({
      title: 'Test',
      slug: 'test',
      mediaBuffer: Buffer.from('bytes'),
    });
  } catch (err) {
    if (err instanceof WordPressApiError) {
      caughtApiError = true;
      ok(`WordPressApiError thrown (status=${err.status}, code=${err.code})`);
    }
  }
  if (!caughtApiError) fail('Expected WordPressApiError from 401 response');

  // -------------------------------------------------------------------------
  // Step 6 — validation error (missing mediaBuffer)
  // -------------------------------------------------------------------------
  section('Step 6 — publishMedia() — validation (missing mediaBuffer)');

  const { PublishingValidationError } = await import('@pcme/publishing');
  let caughtValidation = false;
  try {
    await publisherOk.publishMedia({ title: 'Photo', slug: 'photo' });
  } catch (err) {
    if (err instanceof PublishingValidationError) caughtValidation = true;
  }
  if (!caughtValidation) fail('Expected PublishingValidationError for missing mediaBuffer');
  ok('Missing mediaBuffer → PublishingValidationError');

  // -------------------------------------------------------------------------
  // Step 7 — Real WordPress smoke (opt-in only)
  // -------------------------------------------------------------------------
  if (process.env['WP_REAL_SMOKE'] === '1') {
    section('Step 7 — Real WordPress smoke (WP_REAL_SMOKE=1)');
    try {
      const realConfig = loadWordPressConfig(process.env as Record<string, string>);
      const realPublisher = new WordPressMediaPublisher(realConfig);
      const realHealth = await realPublisher.health();
      ok(`Real health().status = ${realHealth.status}`);
      if (realHealth.message) ok(`  message: ${realHealth.message}`);
    } catch (err) {
      if (err instanceof WordPressConfigError) {
        process.stdout.write(`  ℹ Skipped: ${err.message}\n`);
      } else {
        throw err;
      }
    }
  } else {
    process.stdout.write('\n  ℹ Step 7 (real WordPress) skipped — set WP_REAL_SMOKE=1 to enable\n');
  }

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  process.stdout.write(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅  WordPress Smoke PASSED — Sprint 14 media upload            ║
╚══════════════════════════════════════════════════════════════════╝

Publisher: WordPressMediaPublisher
HTTP:      fake in-process server (no real WordPress required)
Steps:     health(ok) / health(down) / health(no-config) /
           publishMedia(ok) / publishMedia(401) / validation
`);
}

smoke().catch((err: unknown) => {
  process.stderr.write('\n✗ Unhandled error in smoke script:\n');
  if (err instanceof Error) process.stderr.write(`${err.stack ?? err.message}\n`);
  process.exit(1);
});
