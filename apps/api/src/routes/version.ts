import type { FastifyInstance } from 'fastify';

export type VersionResponse = {
  name: string;
  version: string;
  env: string;
};

export type VersionRouteOptions = {
  version: string;
  env: string;
};

export async function versionRoutes(
  app: FastifyInstance,
  options: VersionRouteOptions,
): Promise<void> {
  app.get<{ Reply: VersionResponse }>(
    '/version',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              env: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        name: 'pc-media-engine-api',
        version: options.version,
        env: options.env,
      });
    },
  );
}
