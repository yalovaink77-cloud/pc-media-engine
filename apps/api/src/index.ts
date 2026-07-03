/**
 * API entry point.
 *
 * Loads environment variables from the monorepo root .env file (if present),
 * then starts the Fastify server.
 *
 * In production, environment variables are injected by the platform and
 * dotenv is a no-op (the file won't exist).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../.env'), override: false });

import { loadConfig } from './config.js';
import { startServer } from './server.js';

const config = loadConfig();
await startServer(config);
