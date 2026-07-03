import type { FastifyInstance } from 'fastify';

export type DatabaseStatus = 'ok' | 'unavailable' | 'skipped';

export type HealthResponse = {
  status: 'ok';
  uptime: number;
  env: string;
  version: string;
  database: DatabaseStatus;
};

export type HealthRouteOptions = {
  version: string;
  env: string;
  /**
   * Injected database check function.
   * Pass undefined to skip the check (tests, no DATABASE_URL).
   */
  checkDatabase?: () => Promise<DatabaseStatus>;
};

export async function healthRoutes(
  app: FastifyInstance,
  options: HealthRouteOptions,
): Promise<void> {
  app.get<{ Reply: HealthResponse }>(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptime: { type: 'number' },
              env: { type: 'string' },
              version: { type: 'string' },
              database: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const database: DatabaseStatus = options.checkDatabase
        ? await options.checkDatabase()
        : 'skipped';

      const body: HealthResponse = {
        status: 'ok',
        uptime: Math.round(process.uptime() * 1000) / 1000,
        env: options.env,
        version: options.version,
        database,
      };

      return reply.status(200).send(body);
    },
  );
}
