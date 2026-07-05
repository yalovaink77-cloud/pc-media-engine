/**
 * Sprint 24 — Retry Engine Smoke Test
 *
 * Runs entirely in-process — no Redis or database required.
 * Simulates the BullMQ retry cycle by calling executePublishingJobWithRetry
 * directly with incrementing attemptsMade values.
 *
 * Scenario 1 — Fail twice, succeed on third attempt:
 *   Attempt 1  → throw  (retry scheduled)
 *   Attempt 2  → throw  (retry scheduled)
 *   Attempt 3  → return (success, history row written)
 *   PublishedContent rows: 1
 *
 * Scenario 2 — Duplicate: no retry triggered:
 *   Attempt 1  → return { skipped: true, reason: "duplicate" }
 *   PublishedContent rows: 0
 *
 * Usage: pnpm retry:smoke
 */

import type { PublishedContent } from '@pcme/database';
import type { Publisher, PublishingRequest, PublishingResult } from '@pcme/publishing';

import type { PublishingProcessorDeps } from '../src/processors/publishing.processor.js';
import type { PublishedContentWriter } from '../src/publishing/persist-published-content.js';
import type { PublishingJobContext } from '../src/publishing-worker.js';
import { executePublishingJobWithRetry } from '../src/publishing-worker.js';
import type { PublishingJobPayload } from '../src/queue/publishing-payload.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function ok(msg: string): void {
  process.stdout.write(`  ✓ ${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`\n✗ RETRY SMOKE FAILED: ${msg}\n`);
  process.exit(1);
}

function ctx(attemptsMade: number, totalAttempts = 4): PublishingJobContext {
  return { attemptsMade, totalAttempts, jobId: 'smoke-job' };
}

// ---------------------------------------------------------------------------
// In-memory repo
// ---------------------------------------------------------------------------

type StoredRecord = PublishedContent & { slug: string };

function makeRepo(): PublishedContentWriter & { records: StoredRecord[] } {
  const records: StoredRecord[] = [];
  return {
    records,
    async create(input) {
      const r = {
        id: `pub-${records.length + 1}`,
        organizationId: input.organizationId,
        projectId: input.projectId,
        assetId: input.assetId,
        slug: (input as unknown as { slug: string }).slug ?? '',
        publisher: input.publisher,
        externalId: input.externalId,
        url: input.url,
        status: input.status,
        publishedAt: input.publishedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as StoredRecord;
      records.push(r);
      return r as unknown as PublishedContent;
    },
    async findDuplicate(projectId, publisher, slug) {
      return (
        (records.find(
          (r) => r.projectId === projectId && r.publisher === publisher && r.slug === slug,
        ) as PublishedContent | undefined) ?? null
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Counting publisher — fails N times then succeeds
// ---------------------------------------------------------------------------

function makeCountingPublisher(failFirstN: number): Publisher & { callCount: number } {
  let callCount = 0;

  const publishMedia = async (_request: PublishingRequest): Promise<PublishingResult> => {
    callCount++;
    if (callCount <= failFirstN) {
      throw new Error(`Simulated failure #${callCount}`);
    }
    return {
      success: true,
      externalId: `media-retry-ok`,
      url: `https://mock/media/retry-ok`,
      publishedAt: new Date(),
    };
  };

  const publishPost = async (_req: PublishingRequest): Promise<PublishingResult> => ({
    success: true,
    externalId: `post-retry-ok`,
    url: `https://mock/posts/retry-ok`,
    publishedAt: new Date(),
  });

  return {
    name: 'CountingPublisher',
    publishMedia,
    publishPost,
    publish: publishMedia,
    health: async () => ({ status: 'ok' }),
    get callCount() {
      return callCount;
    },
  } as Publisher & { callCount: number };
}

// ---------------------------------------------------------------------------
// Smoke payload
// ---------------------------------------------------------------------------

const PAYLOAD: PublishingJobPayload = {
  title: 'Retry Test Article',
  slug: 'retry-test-article',
  body: '<p>Testing retry engine.</p>',
  mediaData: 'mock-image-bytes',
  mediaMimeType: 'image/jpeg',
  organizationId: 'org-smoke',
  projectId: 'proj-smoke',
  assetId: 'asset-smoke',
  processingJobId: 'job-smoke',
};

// ---------------------------------------------------------------------------
// Scenario 1: Fail twice, succeed on third attempt
// ---------------------------------------------------------------------------

async function scenarioRetrySuccess(): Promise<void> {
  line('\nScenario 1: Fail twice, succeed on third attempt');
  line('─'.repeat(50));

  const publisher = makeCountingPublisher(2);
  const repo = makeRepo();

  const deps: PublishingProcessorDeps = {
    createPublisher: () => publisher,
    publishedContentRepo: repo,
  };

  // Attempt 1 — should throw
  line('\nAttempt 1 (expects failure):');
  try {
    await executePublishingJobWithRetry(PAYLOAD, ctx(0), deps);
    fail('Attempt 1 should have thrown but did not');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('Simulated failure #1')) {
      fail(`Attempt 1 threw unexpected error: "${msg}"`);
    }
    ok(`threw: "${msg}"`);
  }

  // Attempt 2 — should throw
  line('\nAttempt 2 (expects failure):');
  try {
    await executePublishingJobWithRetry(PAYLOAD, ctx(1), deps);
    fail('Attempt 2 should have thrown but did not');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('Simulated failure #2')) {
      fail(`Attempt 2 threw unexpected error: "${msg}"`);
    }
    ok(`threw: "${msg}"`);
  }

  // Attempt 3 — should succeed
  line('\nAttempt 3 (expects success):');
  const result = await executePublishingJobWithRetry(PAYLOAD, ctx(2), deps);

  if (!result.success) fail(`Attempt 3 returned success=false: ${JSON.stringify(result)}`);
  if (result.skipped) fail('Attempt 3 should not be skipped');
  ok(
    `success=true media=${result.media?.externalId ?? '—'} post=${result.post?.externalId ?? '—'}`,
  );

  if (repo.records.length !== 1) {
    fail(`Expected 1 history row, got ${repo.records.length}`);
  }
  ok(`history rows: 1`);
  ok(`publisher called ${publisher.callCount} times total`);
}

// ---------------------------------------------------------------------------
// Scenario 2: Duplicate — no retry
// ---------------------------------------------------------------------------

async function scenarioDuplicateNoRetry(): Promise<void> {
  line('\nScenario 2: Duplicate detected — no retry triggered');
  line('─'.repeat(50));

  const repo = makeRepo();

  // Pre-populate the repo with an existing record for the same slug
  await repo.create({
    organizationId: 'org-smoke',
    projectId: 'proj-smoke',
    assetId: 'asset-smoke',
    slug: PAYLOAD.slug,
    publisher: 'mock',
    externalId: 'post-existing',
    url: 'https://mock/posts/existing',
    status: 'draft',
    publishedAt: new Date(),
  } as Parameters<typeof repo.create>[0]);

  const publishMedia = jest_fn();
  const publishPost = jest_fn();

  const deps: PublishingProcessorDeps = {
    publisherDriver: 'mock',
    createPublisher: () => ({
      name: 'SpyPublisher',
      publishMedia,
      publishPost,
      publish: publishMedia,
      health: async () => ({ status: 'ok' as const }),
    }),
    publishedContentRepo: repo,
  };

  // Should return without throwing
  const result = await executePublishingJobWithRetry(PAYLOAD, ctx(0), deps);

  if (result.success) fail('Expected success=false for duplicate');
  if (!result.skipped) fail('Expected skipped=true for duplicate');
  if (result.reason !== 'duplicate') fail(`Expected reason="duplicate", got "${result.reason}"`);
  ok('success=false');
  ok('skipped=true');
  ok('reason="duplicate"');

  if (publishMedia.calls > 0) fail('Publisher was called but should not have been');
  ok('publisher not called');

  if (repo.records.length !== 1) {
    fail(`Expected 1 history row (pre-existing only), got ${repo.records.length}`);
  }
  ok('history rows: 1 (pre-existing, unchanged)');
}

// Simple spy function (no vi dependency in script context)
function jest_fn(): ((...args: unknown[]) => Promise<never>) & { calls: number } {
  let calls = 0;
  const fn = async (..._args: unknown[]): Promise<never> => {
    calls++;
    throw new Error('Should not be called');
  };
  Object.defineProperty(fn, 'calls', { get: () => calls });
  return fn as ReturnType<typeof jest_fn>;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

line('\n═══ Sprint 24 Retry Engine Smoke ═══');

async function main(): Promise<void> {
  await scenarioRetrySuccess();
  await scenarioDuplicateNoRetry();

  line('\n═══ All checks passed ✓ ═══\n');
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
