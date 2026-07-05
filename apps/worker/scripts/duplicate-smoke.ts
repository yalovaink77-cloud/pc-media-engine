/**
 * Sprint 23 — Duplicate Detection Smoke Test
 *
 * Runs entirely in-process with an in-memory repository — no Redis or database required.
 *
 * Flow:
 *   1. Publish article A            → success: true,  1 history row
 *   2. Publish article A again      → success: false, skipped: true, reason: "duplicate"
 *                                     0 new history rows
 *   3. Publish article B (different slug) → success: true, 2 history rows total
 *
 * Usage:  pnpm duplicate:smoke
 */

import type { PublishedContent } from '@pcme/database';

import { processPublishingJob } from '../src/processors/publishing.processor.js';
import type { PublishedContentWriter } from '../src/publishing/persist-published-content.js';
import type { PublishingJobPayload } from '../src/queue/publishing-payload.js';

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function ok(msg: string): void {
  process.stdout.write(`  ✓ ${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`\n✗ DUPLICATE SMOKE FAILED: ${msg}\n`);
  process.exit(1);
}

line('\n═══ Sprint 23 Duplicate Detection Smoke ═══\n');

// ---------------------------------------------------------------------------
// In-memory repository (no DB or Redis needed)
// ---------------------------------------------------------------------------

type StoredRecord = PublishedContent & { slug: string };

function makeInMemoryRepo(): PublishedContentWriter & { records: StoredRecord[] } {
  const records: StoredRecord[] = [];

  return {
    records,

    async create(input) {
      const record = {
        id: `pub-${records.length + 1}`,
        organizationId: input.organizationId,
        projectId: input.projectId,
        assetId: input.assetId,
        slug: (input as unknown as { slug: string }).slug,
        publisher: input.publisher,
        externalId: input.externalId,
        url: input.url,
        status: input.status,
        publishedAt: input.publishedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as StoredRecord;
      records.push(record);
      return record as unknown as PublishedContent;
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
// Test payloads
// ---------------------------------------------------------------------------

const PAYLOAD_A: PublishingJobPayload = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  body: '<p>Clean twice daily.</p>',
  mediaData: 'mock-image-bytes',
  mediaMimeType: 'image/jpeg',
  organizationId: 'org-smoke',
  projectId: 'proj-smoke',
  assetId: 'asset-smoke-a',
  processingJobId: 'job-smoke-a',
};

const PAYLOAD_B: PublishingJobPayload = {
  ...PAYLOAD_A,
  title: 'Healing Tips',
  slug: 'healing-tips',
  assetId: 'asset-smoke-b',
  processingJobId: 'job-smoke-b',
};

async function main(): Promise<void> {
  const repo = makeInMemoryRepo();

  // ── Publish A (first time) ──────────────────────────────────────────────
  line('1. Publish article A (first time)');
  const result1 = await processPublishingJob(PAYLOAD_A, {
    publisherDriver: 'mock',
    publishedContentRepo: repo,
  });

  if (!result1.success) fail(`Expected success on first publish, got: ${JSON.stringify(result1)}`);
  if (result1.skipped) fail('Expected no skip on first publish');
  if (repo.records.length !== 1) fail(`Expected 1 history row, got ${repo.records.length}`);
  ok('success=true');
  ok('history rows: 1');

  // ── Publish A again (duplicate) ─────────────────────────────────────────
  line('\n2. Publish article A again (duplicate)');
  const result2 = await processPublishingJob(PAYLOAD_A, {
    publisherDriver: 'mock',
    publishedContentRepo: repo,
  });

  if (result2.success) fail('Expected success=false for duplicate');
  if (!result2.skipped) fail('Expected skipped=true for duplicate');
  if (result2.reason !== 'duplicate') fail(`Expected reason="duplicate", got "${result2.reason}"`);
  if (repo.records.length !== 1) fail(`Expected still 1 history row, got ${repo.records.length}`);
  ok('success=false');
  ok('skipped=true');
  ok('reason="duplicate"');
  ok('history rows: 1 (unchanged)');

  // ── Publish B (different slug — should succeed) ──────────────────────────
  line('\n3. Publish article B (different slug, non-duplicate)');
  const result3 = await processPublishingJob(PAYLOAD_B, {
    publisherDriver: 'mock',
    publishedContentRepo: repo,
  });

  if (!result3.success) fail(`Expected success on article B, got: ${JSON.stringify(result3)}`);
  if (result3.skipped) fail('Expected no skip for article B');
  if (repo.records.length !== 2) fail(`Expected 2 history rows, got ${repo.records.length}`);
  ok('success=true');
  ok('history rows: 2');

  line('\n═══ All checks passed ✓ ═══\n');
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
