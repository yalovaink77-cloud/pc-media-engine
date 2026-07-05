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
import { startWorker } from './worker.js';

const config = loadWorkerConfig();
const processingWorker = startWorker(config);
const publishingWorker = config.autoEnqueuePublishing ? startPublishingWorker(config) : undefined;

console.log(`[worker] Started — queue: ${PROCESSING_QUEUE}, concurrency: ${config.concurrency}`);
if (publishingWorker) {
  console.log(`[worker] Publishing worker started — queue: ${PUBLISHING_QUEUE}`);
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received — shutting down`);
  await processingWorker.close();
  await publishingWorker?.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
