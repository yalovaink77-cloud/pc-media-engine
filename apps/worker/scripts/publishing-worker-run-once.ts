/**
 * Execute one durable publishing worker cycle.
 *
 * Requires DATABASE_URL, PCME_DEFAULT_ORG_ID, and PCME_DEFAULT_PROJECT_ID.
 * WordPress adapter is registered only when PCME_DURABLE_PUBLISHING_REGISTER_WORDPRESS=true
 * and WordPress credentials are configured. Draft-only remains the default.
 *
 * Run: pnpm publishing-worker:run-once
 */

import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

import {
  createDurablePublishingWorker,
  formatDurablePublishingWorkerLog,
} from '../src/durable-publishing/bootstrap.js';
import { loadDurablePublishingWorkerConfig } from '../src/durable-publishing/config.js';

loadEnv({ path: resolve(process.cwd(), '../../.env') });

async function main(): Promise<void> {
  const config = loadDurablePublishingWorkerConfig();
  if (!config) {
    console.log(
      'Durable publishing worker is not configured. Set DATABASE_URL, PCME_DEFAULT_ORG_ID, and PCME_DEFAULT_PROJECT_ID to run once.',
    );
    process.exit(0);
  }

  const worker = createDurablePublishingWorker(config);
  const result = await worker.runOnce();
  console.log(formatDurablePublishingWorkerLog(result));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/\/(?:home|Users|var|tmp|etc)[^\s'"]+/gi, '[REDACTED_PATH]'));
  process.exit(1);
});
