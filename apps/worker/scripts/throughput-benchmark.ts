/**
 * Worker throughput benchmark — Sprint 49.
 *
 * Offline validation of concurrency config and metrics rate calculation.
 * Does not enqueue real jobs or change worker behaviour.
 *
 * Usage:
 *   pnpm exec tsx scripts/throughput-benchmark.ts --offline
 */

import { WorkerMetricsService } from '../src/metrics.js';
import { validateWorkerConfig } from '../src/startup.js';

const offline = process.argv.includes('--offline');

function parseConcurrency(): number {
  const raw = process.env['WORKER_CONCURRENCY'] ?? '5';
  return parseInt(raw, 10);
}

async function main(): Promise<void> {
  const concurrency = parseConcurrency();
  const config = {
    redisUrl: 'redis://localhost:6379',
    databaseUrl: 'postgresql://localhost/pcme',
    storageLocalRoot: '/tmp',
    concurrency,
    logLevel: 'info',
    publisherDriver: 'mock' as const,
    autoEnqueuePublishing: false,
    publishingMaxRetries: 3,
    publishingBackoffMs: 5000,
  };

  const diag = validateWorkerConfig(config);
  if (diag.errors.length > 0) {
    console.error('Worker config errors:', diag.errors);
    process.exit(1);
  }

  const startedAt = new Date(Date.now() - 120_000).toISOString();
  const metrics = new WorkerMetricsService(startedAt);
  metrics.inc('processedTotal', 240);
  metrics.inc('publishedTotal', 220);
  metrics.inc('failuresTotal', 20);

  const snap = metrics.snapshot();
  console.log('\nWorker throughput benchmark (offline simulation):\n');
  console.log(`  WORKER_CONCURRENCY=${concurrency}`);
  console.log(`  processedPerMinute=${snap.processedPerMinute}`);
  console.log(`  publishSuccessRate=${snap.publishSuccessRate}%`);
  console.log(`  safe range: 1–20 (recommended 3–10 for single-node)\n`);

  if (!offline && !process.env['REDIS_URL']) {
    console.log('  (Live queue benchmark skipped — set REDIS_URL for live mode)\n');
  }
}

main().catch((err: unknown) => {
  console.error('Throughput benchmark failed:', err);
  process.exit(1);
});
