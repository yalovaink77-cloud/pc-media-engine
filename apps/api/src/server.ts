import { getPrismaClient } from '@pcme/database';

import { buildApp } from './app.js';
import type { Config } from './config.js';
import type { DatabaseStatus } from './routes/health.js';

/**
 * Build a live database health check function using Prisma.
 * Always resolves — never rejects — so it can never crash the health endpoint.
 */
function buildDatabaseCheck(_databaseUrl: string): () => Promise<DatabaseStatus> {
  return async (): Promise<DatabaseStatus> => {
    try {
      const client = getPrismaClient();
      await client.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'unavailable';
    }
  };
}

export async function startServer(config: Config): Promise<void> {
  const checkDatabase = config.databaseUrl ? buildDatabaseCheck(config.databaseUrl) : undefined;

  const app = buildApp({ config, checkDatabase });

  const gracefulShutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutdown signal received — closing server');
    try {
      await app.close();
      app.log.info('Server closed cleanly');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}
