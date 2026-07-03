import type { FastifyInstance } from 'fastify';

export type RootResponse = {
  service: string;
  docs: string;
};

export async function rootRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: RootResponse }>(
    '/',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              service: { type: 'string' },
              docs: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        service: 'PC Media Engine API',
        docs: '/health, /version',
      });
    },
  );
}
