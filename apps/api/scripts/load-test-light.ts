/**
 * Lightweight concurrent load test — Sprint 49.
 *
 * Offline: parallel fastify.inject() requests (no network).
 * Live:   set API_BASE_URL for concurrent fetch against a running server.
 *
 * Usage:
 *   pnpm --filter @pcme/api exec tsx scripts/load-test-light.ts --offline
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';

const CONCURRENCY = 20;
const REQUESTS_PER_WORKER = 10;
const offline = process.argv.includes('--offline');
const apiBase = process.env['API_BASE_URL'];

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.0.0-load',
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

async function runOffline(): Promise<{ total: number; errors: number; elapsedMs: number }> {
  const app = buildApp({ config: baseConfig });
  const start = performance.now();
  let errors = 0;

  try {
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      for (let i = 0; i < REQUESTS_PER_WORKER; i++) {
        const res = await app.inject({ method: 'GET', url: '/health' });
        if (res.statusCode !== 200) errors++;
      }
    });
    await Promise.all(workers);
  } finally {
    await app.close();
  }

  return {
    total: CONCURRENCY * REQUESTS_PER_WORKER,
    errors,
    elapsedMs: Math.round(performance.now() - start),
  };
}

async function runLive(): Promise<{ total: number; errors: number; elapsedMs: number }> {
  if (!apiBase) throw new Error('API_BASE_URL is required for live mode');
  const start = performance.now();
  let errors = 0;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let i = 0; i < REQUESTS_PER_WORKER; i++) {
      const res = await fetch(`${apiBase}/health`);
      if (!res.ok) errors++;
    }
  });
  await Promise.all(workers);

  return {
    total: CONCURRENCY * REQUESTS_PER_WORKER,
    errors,
    elapsedMs: Math.round(performance.now() - start),
  };
}

async function main(): Promise<void> {
  const result = offline || !apiBase ? await runOffline() : await runLive();
  const rps = Math.round((result.total / result.elapsedMs) * 1000);

  console.log(`\nLoad test (${offline || !apiBase ? 'offline' : apiBase}):`);
  console.log(
    `  requests=${result.total}  errors=${result.errors}  elapsed=${result.elapsedMs}ms  ~${rps} req/s\n`,
  );

  if (result.errors > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
