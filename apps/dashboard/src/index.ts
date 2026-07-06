import { buildDashboardApp } from './app.js';
import { createDashboardApiClient } from './client.js';
import { loadDashboardConfig } from './config.js';

const config = loadDashboardConfig();
const client = createDashboardApiClient(config.apiBaseUrl);

const app = buildDashboardApp({ client, logLevel: config.logLevel });

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error({ err }, 'Failed to start dashboard server');
  process.exit(1);
}
