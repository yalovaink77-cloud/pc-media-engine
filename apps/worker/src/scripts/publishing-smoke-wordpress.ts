/**
 * Real WordPress publishing smoke — Sprint 18 (MANUAL ONLY).
 *
 * ⚠️  Do NOT run in CI. Requires live WordPress credentials and network access.
 *
 * Prerequisites:
 *   docker compose up -d   (Redis)
 *   WordPress site with Application Password configured
 *
 * Required env vars (from .env):
 *   REDIS_URL
 *   PUBLISHER_DRIVER=wordpress   (or set in .env)
 *   WORDPRESS_BASE_URL
 *   WORDPRESS_USERNAME
 *   WORDPRESS_APP_PASSWORD
 *
 * Usage:
 *   pnpm --filter @pcme/worker publishing:smoke:wordpress
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env'), override: false });

import { loadWordPressConfig, WordPressConfigError } from '@pcme/plugin-wordpress';
import type { PublishingFlowResult } from '@pcme/publishing';
import { Queue, QueueEvents, Worker } from 'bullmq';

import { parseRedisConnection } from '../config.js';
import { processPublishingJob } from '../processors/publishing.processor.js';
import { PUBLISHING_QUEUE } from '../queue/names.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import { validatePublishingJobPayload } from '../queue/publishing-payload.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const connection = parseRedisConnection(REDIS_URL);

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`\n✗ WORDPRESS SMOKE FAILED: ${msg}\n`);
  process.exit(1);
}

line('\n═══ Sprint 18 Real WordPress Publishing Smoke (MANUAL) ═══\n');
line('⚠️  This smoke contacts a real WordPress site. Not for CI.\n');

try {
  const wpConfig = loadWordPressConfig(process.env as Record<string, string>);
  line(`  ✓ WordPress config loaded (baseUrl=${wpConfig.baseUrl})`);
} catch (err) {
  if (err instanceof WordPressConfigError) {
    fail(err.message);
  }
  throw err;
}

if ((process.env['PUBLISHER_DRIVER'] ?? 'mock') !== 'wordpress') {
  line('  ℹ Set PUBLISHER_DRIVER=wordpress in .env (continuing with explicit wordpress driver)');
}

const queue = new Queue<PublishingJobPayload>(PUBLISHING_QUEUE, { connection });
const queueEvents = new QueueEvents(PUBLISHING_QUEUE, { connection });
await queue.waitUntilReady();
line('  ✓ Redis reachable');

const worker = new Worker<PublishingJobPayload>(
  PUBLISHING_QUEUE,
  async (job) => {
    const payload = validatePublishingJobPayload(job.data);
    return processPublishingJob(payload, { publisherDriver: 'wordpress' });
  },
  { connection, concurrency: 1 },
);
await worker.waitUntilReady();
line('  ✓ Publishing worker ready (WordPressMediaPublisher)');

const payload: PublishingJobPayload = {
  title: `PCME Smoke ${new Date().toISOString()}`,
  slug: `pcme-smoke-${Date.now()}`,
  body: '<p>Automated smoke test from PC Media Engine Sprint 18.</p>',
  mediaData: 'smoke-wordpress-image-bytes',
  mediaMimeType: 'image/jpeg',
  mediaFilename: 'pcme-smoke.jpg',
};

const bullJob = await queue.add('publish-wordpress', payload);
line(`  ✓ Enqueued job (id=${bullJob.id})`);

const flowResult = await new Promise<PublishingFlowResult>((resolvePromise, reject) => {
  const timer = setTimeout(() => reject(new Error('Timeout after 60s')), 60_000);

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    if (jobId === bullJob.id) {
      clearTimeout(timer);
      const parsed =
        typeof returnvalue === 'string'
          ? (JSON.parse(returnvalue) as PublishingFlowResult)
          : (returnvalue as PublishingFlowResult);
      resolvePromise(parsed);
    }
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    if (jobId === bullJob.id) {
      clearTimeout(timer);
      reject(new Error(failedReason));
    }
  });
});

if (!flowResult.success) fail(`Publishing failed: ${flowResult.message ?? 'unknown'}`);

line(`  ✓ media.externalId = ${flowResult.media?.externalId ?? '—'}`);
line(`  ✓ media.url = ${flowResult.media?.url ?? '—'}`);
line(`  ✓ post.externalId = ${flowResult.post?.externalId ?? '—'}`);
line(`  ✓ post.url = ${flowResult.post?.url ?? '—'}`);

line(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅  Real WordPress Publishing Smoke PASSED                     ║
╚══════════════════════════════════════════════════════════════════╝
`);

await worker.close();
await queueEvents.close();
await queue.close();
process.exit(0);
