/**
 * Worker entry point.
 *
 * Loads environment variables from the monorepo root .env file (if present),
 * then starts the BullMQ processing worker.
 *
 * In production, environment variables are injected by the platform and
 * dotenv is a no-op (the file won't exist).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../.env'), override: false });

import { loadWorkerConfig } from './config.js';
import { startPublishingWorker } from './publishing-worker.js';
import { PROCESSING_QUEUE, PUBLISHING_QUEUE } from './queue/names.js';
import {
  assertNoFatalWorkerErrors,
  logWorkerStartupSummary,
  validateWorkerConfig,
} from './startup.js';
import { startWorker } from './worker.js';

const startedAt = new Date().toISOString();
const config = loadWorkerConfig();

// Validate configuration before connecting to Redis — fail fast on fatal errors.
const diagnostic = validateWorkerConfig(config);
assertNoFatalWorkerErrors(diagnostic);
logWorkerStartupSummary(config, startedAt);

const processingWorker = startWorker(config);
const publishingWorker = config.autoEnqueuePublishing ? startPublishingWorker(config) : undefined;

console.log(
  `[worker] Processing worker online — queue: ${PROCESSING_QUEUE}, concurrency: ${config.concurrency}`,
);
if (publishingWorker) {
  console.log(`[worker] Publishing worker online — queue: ${PUBLISHING_QUEUE}`);
} else {
  console.log(
    `[worker] Publishing worker skipped — set PCME_AUTO_ENQUEUE_PUBLISHING=true to enable`,
  );
}

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[worker] ${signal} received — graceful shutdown starting`);
  const errors: unknown[] = [];

  try {
    await processingWorker.close();
    console.log('[worker] Processing worker closed');
  } catch (err) {
    console.error('[worker] Error closing processing worker:', err);
    errors.push(err);
  }

  try {
    await publishingWorker?.close();
    if (publishingWorker) console.log('[worker] Publishing worker closed');
  } catch (err) {
    console.error('[worker] Error closing publishing worker:', err);
    errors.push(err);
  }

  if (errors.length > 0) {
    console.error(`[worker] Shutdown completed with ${errors.length} error(s)`);
    process.exit(1);
  } else {
    console.log('[worker] Shutdown complete');
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[worker] Uncaught exception — shutting down:', err);
  void shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[worker] Unhandled rejection — shutting down:', reason);
  void shutdown('unhandledRejection');
});
