/**
 * Sprint 25 — Publishing Scheduler Smoke Test
 *
 * Runs entirely in-process — no Redis or database required.
 *
 * Scenario 1: Immediate job (no scheduledFor)
 *   → success, history row created
 *
 * Scenario 2: Past scheduledFor → immediate (delay = 0)
 *   → success, history row created
 *
 * Scenario 3: Future scheduledFor → delayed (delay > 0)
 *   → computeScheduleDelay returns positive ms
 *   → once running, processor publishes normally (success, history row)
 *
 * Scenario 4: Invalid scheduledFor → validation error
 *
 * Scenario 5: Duplicate scheduled job → skipped, no new history row
 *
 * Usage: pnpm scheduler:smoke
 */

import type { PublishedContent } from '@pcme/database';

import type { PublishingProcessorDeps } from '../src/processors/publishing.processor.js';
import type { PublishedContentWriter } from '../src/publishing/persist-published-content.js';
import type { PublishingJobContext } from '../src/publishing-worker.js';
import { executePublishingJobWithRetry } from '../src/publishing-worker.js';
import { computeScheduleDelay } from '../src/queue/publishing-enqueue.js';
import type { PublishingJobPayload } from '../src/queue/publishing-payload.js';
import {
  PublishingPayloadValidationError,
  validatePublishingJobPayload,
} from '../src/queue/publishing-payload.js';

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
  process.stderr.write(`\n✗ SCHEDULER SMOKE FAILED: ${msg}\n`);
  process.exit(1);
}

function ctx(): PublishingJobContext {
  return { attemptsMade: 0, totalAttempts: 4, jobId: 'smoke-job' };
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
// Base payload
// ---------------------------------------------------------------------------

const BASE: PublishingJobPayload = {
  title: 'Scheduler Test Article',
  slug: 'scheduler-test-article',
  body: '<p>Testing scheduler.</p>',
  mediaData: 'mock-image-bytes',
  mediaMimeType: 'image/jpeg',
  organizationId: 'org-smoke',
  projectId: 'proj-smoke',
  assetId: 'asset-smoke',
  processingJobId: 'job-smoke',
};

// ---------------------------------------------------------------------------
// Scenario 1: Immediate job (no scheduledFor)
// ---------------------------------------------------------------------------

async function scenarioImmediate(): Promise<void> {
  line('\nScenario 1: Immediate job (no scheduledFor)');
  line('─'.repeat(50));

  const repo = makeRepo();
  const deps: PublishingProcessorDeps = { publisherDriver: 'mock', publishedContentRepo: repo };

  const result = await executePublishingJobWithRetry(BASE, ctx(), deps);

  if (!result.success) fail(`Expected success, got: ${JSON.stringify(result)}`);
  if (result.skipped) fail('Expected no skip');
  ok('success=true');

  if (repo.records.length !== 1) fail(`Expected 1 history row, got ${repo.records.length}`);
  ok('history rows: 1');

  const delay = computeScheduleDelay(undefined);
  if (delay !== 0) fail(`Expected delay=0 for no scheduledFor, got ${delay}`);
  ok('computeScheduleDelay(undefined) = 0');
}

// ---------------------------------------------------------------------------
// Scenario 2: Past scheduledFor → immediate
// ---------------------------------------------------------------------------

async function scenarioPastScheduled(): Promise<void> {
  line('\nScenario 2: Past scheduledFor → immediate (delay = 0)');
  line('─'.repeat(50));

  const past = new Date(Date.now() - 60_000).toISOString();
  const delay = computeScheduleDelay(past);

  if (delay !== 0) fail(`Expected delay=0 for past datetime, got ${delay}`);
  ok(`computeScheduleDelay("${past.slice(0, 19)}…") = 0`);

  const repo = makeRepo();
  const deps: PublishingProcessorDeps = { publisherDriver: 'mock', publishedContentRepo: repo };

  const result = await executePublishingJobWithRetry({ ...BASE, scheduledFor: past }, ctx(), deps);

  if (!result.success)
    fail(`Expected success for past scheduledFor, got: ${JSON.stringify(result)}`);
  ok('success=true (immediate publish)');

  if (repo.records.length !== 1) fail(`Expected 1 history row, got ${repo.records.length}`);
  ok('history rows: 1');
}

// ---------------------------------------------------------------------------
// Scenario 3: Future scheduledFor → delayed job
// ---------------------------------------------------------------------------

async function scenarioFutureScheduled(): Promise<void> {
  line('\nScenario 3: Future scheduledFor → delay > 0, processor publishes normally');
  line('─'.repeat(50));

  const future = new Date(Date.now() + 30_000).toISOString();
  const delay = computeScheduleDelay(future);

  if (delay <= 0) fail(`Expected positive delay for future datetime, got ${delay}`);
  ok(`computeScheduleDelay(now+30s) = ${delay}ms > 0`);

  // Once the BullMQ delayed job starts executing, scheduledFor is informational
  // — the processor publishes normally regardless.
  const repo = makeRepo();
  const deps: PublishingProcessorDeps = { publisherDriver: 'mock', publishedContentRepo: repo };

  const result = await executePublishingJobWithRetry(
    { ...BASE, slug: 'scheduled-article', scheduledFor: future },
    ctx(),
    deps,
  );

  if (!result.success) fail(`Processor failed for scheduled job: ${JSON.stringify(result)}`);
  ok('success=true (processor runs normally once job starts)');

  if (repo.records.length !== 1) fail(`Expected 1 history row, got ${repo.records.length}`);
  ok('history rows: 1');
}

// ---------------------------------------------------------------------------
// Scenario 4: Invalid scheduledFor → validation error
// ---------------------------------------------------------------------------

function scenarioInvalidScheduledFor(): void {
  line('\nScenario 4: Invalid scheduledFor → validation error');
  line('─'.repeat(50));

  const invalids = ['not-a-date', 'tomorrow', '32/13/2026', ''];

  for (const invalid of invalids) {
    if (invalid === '') {
      // Empty string is treated as absent (no error)
      try {
        const p = validatePublishingJobPayload({ ...BASE, scheduledFor: invalid });
        if (p.scheduledFor !== undefined) {
          fail(`Expected scheduledFor to be undefined for empty string`);
        }
        ok(`"${invalid}" → treated as absent (no error)`);
      } catch {
        fail(`Empty scheduledFor should not throw`);
      }
      continue;
    }

    let threw = false;
    try {
      validatePublishingJobPayload({ ...BASE, scheduledFor: invalid });
    } catch (err) {
      if (err instanceof PublishingPayloadValidationError) {
        threw = true;
        ok(`"${invalid}" → PublishingPayloadValidationError`);
      } else {
        fail(`Expected PublishingPayloadValidationError for "${invalid}", got ${String(err)}`);
      }
    }
    if (!threw) fail(`Expected validation error for scheduledFor="${invalid}" but none thrown`);
  }
}

// ---------------------------------------------------------------------------
// Scenario 5: Duplicate scheduled job → skipped
// ---------------------------------------------------------------------------

async function scenarioDuplicateScheduled(): Promise<void> {
  line('\nScenario 5: Duplicate scheduled job → skipped, no new history row');
  line('─'.repeat(50));

  const repo = makeRepo();

  // Pre-publish the article
  const deps: PublishingProcessorDeps = { publisherDriver: 'mock', publishedContentRepo: repo };
  const first = await executePublishingJobWithRetry(BASE, ctx(), deps);
  if (!first.success) fail(`First publish should succeed`);
  ok(`First publish: success=true, history rows: ${repo.records.length}`);

  // Schedule the same article again (future)
  const future = new Date(Date.now() + 10_000).toISOString();
  const second = await executePublishingJobWithRetry(
    { ...BASE, scheduledFor: future },
    ctx(),
    deps,
  );

  if (second.success) fail('Expected success=false for duplicate scheduled job');
  if (!second.skipped) fail('Expected skipped=true for duplicate scheduled job');
  if (second.reason !== 'duplicate') fail(`Expected reason="duplicate", got "${second.reason}"`);
  ok('success=false, skipped=true, reason="duplicate"');

  if (repo.records.length !== 1) {
    fail(`Expected 1 history row (unchanged), got ${repo.records.length}`);
  }
  ok('history rows: 1 (unchanged)');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

line('\n═══ Sprint 25 Publishing Scheduler Smoke ═══');

async function main(): Promise<void> {
  await scenarioImmediate();
  await scenarioPastScheduled();
  await scenarioFutureScheduled();
  scenarioInvalidScheduledFor();
  await scenarioDuplicateScheduled();

  line('\n═══ All checks passed ✓ ═══\n');
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
