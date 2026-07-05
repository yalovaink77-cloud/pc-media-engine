/**
 * Public API surface for tests, smoke scripts, and programmatic embedding.
 * Keep separate from index.ts which starts the HTTP server on import.
 */
export { type AppOptions, buildApp } from './app.js';
export { type Config, loadConfig } from './config.js';
export { buildProcessingEnqueuer } from './queue/redis-enqueue.js';
