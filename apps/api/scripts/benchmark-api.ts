/**
 * Lightweight API endpoint benchmark — Sprint 49.
 *
 * Offline: uses fastify.inject() against an in-memory app (no network).
 * Live:   set API_BASE_URL to benchmark a running server.
 *
 * Usage:
 *   pnpm --filter @pcme/api exec tsx scripts/benchmark-api.ts --offline
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import { MetricsService } from '../src/metrics.js';

const ITERATIONS = 50;
const offline = process.argv.includes('--offline');
const apiBase = process.env['API_BASE_URL'];

type BenchResult = { label: string; avgMs: number; p95Ms: number };

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function summarize(label: string, samples: number[]): BenchResult {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { label, avgMs: Math.round(avg * 100) / 100, p95Ms: percentile(sorted, 95) };
}

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.0.0-bench',
  databaseUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: '',
  defaultProjectId: '',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

async function benchOffline(): Promise<BenchResult[]> {
  const app = buildApp({ config: baseConfig, metricsService: new MetricsService() });
  const results: BenchResult[] = [];

  try {
    for (const path of ['/health', '/version', '/metrics']) {
      const samples: number[] = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const res = await app.inject({ method: 'GET', url: path });
        if (res.statusCode !== 200) throw new Error(`${path} returned ${res.statusCode}`);
        samples.push(performance.now() - start);
      }
      results.push(summarize(path, samples));
    }
  } finally {
    await app.close();
  }

  return results;
}

async function benchLive(): Promise<BenchResult[]> {
  if (!apiBase) throw new Error('API_BASE_URL is required for live mode');
  const results: BenchResult[] = [];

  for (const path of ['/health', '/version', '/metrics']) {
    const samples: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      const res = await fetch(`${apiBase}${path}`);
      if (!res.ok) throw new Error(`${path} returned ${res.status}`);
      await res.text();
      samples.push(performance.now() - start);
    }
    results.push(summarize(path, samples));
  }

  return results;
}

async function main(): Promise<void> {
  const results = offline || !apiBase ? await benchOffline() : await benchLive();
  console.log(`\nAPI benchmark (${offline || !apiBase ? 'offline' : apiBase}, n=${ITERATIONS}):\n`);
  for (const r of results) {
    console.log(`  ${r.label.padEnd(12)} avg=${r.avgMs}ms  p95=${r.p95Ms}ms`);
  }
  console.log('');
}

main().catch((err: unknown) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
