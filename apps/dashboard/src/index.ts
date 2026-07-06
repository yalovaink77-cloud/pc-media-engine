import { buildDashboardApp } from './app.js';
import { createDashboardApiClient } from './client.js';
import { loadDashboardConfig } from './config.js';
import { loadDashboardRbac } from './rbac.js';

const startedAt = new Date().toISOString();
const config = loadDashboardConfig();

if (!config.apiBaseUrl) {
  console.error('[dashboard] FATAL: DASHBOARD_API_BASE_URL must be set');
  process.exit(1);
}

console.log(`[dashboard] ─── PC Media Engine Dashboard ──────────────────────`);
console.log(`[dashboard]   version    : ${config.version}`);
console.log(`[dashboard]   port       : ${config.port}`);
console.log(`[dashboard]   api_base   : ${config.apiBaseUrl}`);
console.log(`[dashboard]   started_at : ${startedAt}`);
console.log(`[dashboard] ──────────────────────────────────────────────────────`);

const client = createDashboardApiClient(config.apiBaseUrl, config.apiKey);
const app = buildDashboardApp({
  client,
  logLevel: config.logLevel,
  apiKeyConfigured: Boolean(config.apiKey),
  apiBaseUrl: config.apiBaseUrl,
  rbac: loadDashboardRbac(),
});

let shuttingDown = false;

const gracefulShutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, '[dashboard] Shutdown signal received — closing');
  try {
    await app.close();
    app.log.info('[dashboard] Server closed cleanly');
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, '[dashboard] Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error({ err }, 'Failed to start dashboard server');
  process.exit(1);
}
