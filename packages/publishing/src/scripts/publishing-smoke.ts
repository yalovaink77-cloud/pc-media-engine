/**
 * Publishing smoke script — Sprint 16 (publishing orchestrator).
 *
 * Verifies MockPublisher and PublishingOrchestrator end-to-end.
 * No database, no Redis, no HTTP requests.
 *
 * Run:
 *   pnpm --filter @pcme/publishing smoke
 */

import { createHash } from 'node:crypto';

import { MockPublisher } from '../mock.publisher.js';
import type { Publisher, PublishingRequest } from '../publisher.js';
import { PublishingValidationError } from '../publisher.js';
import { PublishingOrchestrator } from '../publishing-orchestrator.js';

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

function deterministicId(slug: string): string {
  return createHash('sha1').update(slug).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// Smoke
// ---------------------------------------------------------------------------

async function smoke(): Promise<void> {
  process.stdout.write('═══ Sprint 16 Publishing Smoke (Orchestrator) ═══\n');

  const publisher: Publisher = new MockPublisher();

  // -------------------------------------------------------------------------
  // Step 1 — health()
  // -------------------------------------------------------------------------
  section('Step 1 — health check');

  const health = await publisher.health();
  if (health.status !== 'ok') {
    fail(`Expected health status=ok, got ${health.status}`);
  }
  ok(`health().status = ${health.status}`);

  // -------------------------------------------------------------------------
  // Step 2 — publishMedia
  // -------------------------------------------------------------------------
  section('Step 2 — publishMedia');

  const mediaRequest: PublishingRequest = {
    title: 'Industrial Barbell — Product Shot',
    slug: 'industrial-barbell-product-shot',
    assetId: 'asset-001',
    tags: ['product', 'industrial'],
  };

  const mediaResult = await publisher.publishMedia(mediaRequest);

  if (!mediaResult.success) fail('publishMedia returned success=false');
  ok(`success = ${mediaResult.success}`);

  const expectedMediaId = deterministicId(mediaRequest.slug);
  if (mediaResult.externalId !== `media-${expectedMediaId}`) {
    fail(`Expected externalId=media-${expectedMediaId}, got ${mediaResult.externalId}`);
  }
  ok(`externalId = ${mediaResult.externalId} (deterministic)`);

  const expectedMediaUrl = `https://mock.example.com/media/${expectedMediaId}`;
  if (mediaResult.url !== expectedMediaUrl) {
    fail(`Expected url=${expectedMediaUrl}, got ${mediaResult.url}`);
  }
  ok(`url = ${mediaResult.url}`);

  if (!(mediaResult.publishedAt instanceof Date)) {
    fail('publishedAt is not a Date');
  }
  ok(`publishedAt = ${mediaResult.publishedAt.toISOString()}`);

  // -------------------------------------------------------------------------
  // Step 3 — publishPost
  // -------------------------------------------------------------------------
  section('Step 3 — publishPost');

  const postRequest: PublishingRequest = {
    title: 'Aftercare Guide: Industrial Piercings',
    slug: 'aftercare-guide-industrial-piercings',
    excerpt: 'Keep your new industrial clean and healthy.',
    body: '<p>Clean twice daily with saline solution...</p>',
    tags: ['aftercare', 'industrial'],
    categories: ['care-guides'],
    featuredAssetId: 'asset-002',
  };

  const postResult = await publisher.publishPost(postRequest);

  if (!postResult.success) fail('publishPost returned success=false');
  ok(`success = ${postResult.success}`);

  const expectedPostId = deterministicId(postRequest.slug);
  if (postResult.externalId !== `post-${expectedPostId}`) {
    fail(`Expected externalId=post-${expectedPostId}, got ${postResult.externalId}`);
  }
  ok(`externalId = ${postResult.externalId} (deterministic)`);
  ok(`url = ${postResult.url}`);

  // -------------------------------------------------------------------------
  // Step 4 — publish routing (assetId-only → media, body-present → post)
  // -------------------------------------------------------------------------
  section('Step 4 — publish() routing');

  const mediaOnlyResult = await publisher.publish({
    title: 'Photo',
    slug: 'photo-only',
    assetId: 'asset-003',
  });
  if (!mediaOnlyResult.url.includes('/media/')) {
    fail(`Expected /media/ URL for assetId-only request, got ${mediaOnlyResult.url}`);
  }
  ok(`assetId-only → routed to publishMedia (url=${mediaOnlyResult.url})`);

  const bodyResult = await publisher.publish({
    title: 'Article',
    slug: 'article-with-body',
    assetId: 'asset-003',
    body: '<p>text</p>',
  });
  if (!bodyResult.url.includes('/posts/')) {
    fail(`Expected /posts/ URL for body-present request, got ${bodyResult.url}`);
  }
  ok(`body-present → routed to publishPost (url=${bodyResult.url})`);

  // -------------------------------------------------------------------------
  // Step 5 — deterministic IDs are stable across calls
  // -------------------------------------------------------------------------
  section('Step 5 — deterministic stability');

  const r1 = await publisher.publishMedia(mediaRequest);
  const r2 = await publisher.publishMedia(mediaRequest);
  if (r1.externalId !== r2.externalId || r1.url !== r2.url) {
    fail('Same request produced different results on second call');
  }
  ok('Same slug → same externalId + url on every call');

  const rA = await publisher.publishPost({ title: 'A', slug: 'slug-a' });
  const rB = await publisher.publishPost({ title: 'B', slug: 'slug-b' });
  if (rA.externalId === rB.externalId) {
    fail('Different slugs produced the same externalId');
  }
  ok('Different slugs → different externalIds');

  // -------------------------------------------------------------------------
  // Step 6 — validation errors
  // -------------------------------------------------------------------------
  section('Step 6 — invalid payload rejection');

  let caughtMissingTitle = false;
  try {
    await publisher.publishMedia({ title: '', slug: 'ok-slug' });
  } catch (err) {
    if (err instanceof PublishingValidationError) caughtMissingTitle = true;
  }
  if (!caughtMissingTitle) fail('Expected PublishingValidationError for empty title');
  ok('Empty title → PublishingValidationError');

  let caughtMissingSlug = false;
  try {
    await publisher.publishPost({ title: 'Valid', slug: '' });
  } catch (err) {
    if (err instanceof PublishingValidationError) caughtMissingSlug = true;
  }
  if (!caughtMissingSlug) fail('Expected PublishingValidationError for empty slug');
  ok('Empty slug → PublishingValidationError');

  // -------------------------------------------------------------------------
  // Step 7 — PublishingOrchestrator (full flow)
  // -------------------------------------------------------------------------
  section('Step 7 — PublishingOrchestrator (media → draft)');

  const orchestrator = new PublishingOrchestrator(new MockPublisher());
  const flowRequest: PublishingRequest = {
    title: 'Industrial Aftercare Guide',
    slug: 'industrial-aftercare-guide',
    body: '<p>Clean twice daily with saline solution.</p>',
    excerpt: 'Everything you need to know.',
    tags: ['aftercare', 'industrial'],
    mediaBuffer: Buffer.from('smoke-image-bytes'),
    mediaMimeType: 'image/jpeg',
    mediaFilename: 'industrial-aftercare.jpg',
  };

  const flowResult = await orchestrator.publish(flowRequest);

  if (!flowResult.success) fail('Orchestrator returned success=false');
  ok(`success = ${flowResult.success}`);

  if (!flowResult.media?.externalId) fail('Missing media.externalId');
  ok(`media.externalId = ${flowResult.media.externalId}`);
  ok(`media.url = ${flowResult.media.url}`);

  if (!flowResult.post?.externalId) fail('Missing post.externalId');
  ok(`post.externalId = ${flowResult.post.externalId}`);
  ok(`post.url = ${flowResult.post.url}`);

  if (!(flowResult.publishedAt instanceof Date)) fail('publishedAt is not a Date');
  ok(`publishedAt = ${flowResult.publishedAt.toISOString()}`);

  const mediaId = deterministicId(flowRequest.slug);
  if (flowResult.media.externalId !== `media-${mediaId}`) {
    fail(`Expected media id media-${mediaId}, got ${flowResult.media.externalId}`);
  }
  if (flowResult.post.externalId !== `post-${mediaId}`) {
    fail(`Expected post id post-${mediaId}, got ${flowResult.post.externalId}`);
  }
  ok('Media and draft IDs are deterministic');

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  process.stdout.write(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅  Publishing Smoke PASSED — Sprint 16 Orchestrator           ║
╚══════════════════════════════════════════════════════════════════╝

Publisher:    MockPublisher
Orchestrator: PublishingOrchestrator
Flow:         media upload → draft post → combined result
`);
}

smoke().catch((err: unknown) => {
  process.stderr.write('\n✗ Unhandled error in smoke script:\n');
  if (err instanceof Error) process.stderr.write(`${err.stack ?? err.message}\n`);
  process.exit(1);
});
