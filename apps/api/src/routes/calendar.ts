/**
 * Publishing calendar API routes — Sprint 43.
 *
 * Routes:
 *   GET /calendar/events
 *   GET /calendar/timeline
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

import type { AuthMiddleware } from '../auth/middleware.js';
import type { CalendarService } from '../calendar/types.js';
import { isJobStatus } from '../queue/job-types.js';

export type CalendarRouteOptions = {
  calendarService?: CalendarService;
  authMiddleware?: AuthMiddleware;
};

async function serviceUnavailable(reply: FastifyReply): Promise<void> {
  await reply.status(503).send({
    error: 'Service Unavailable',
    message: 'Calendar is not available (queue not configured)',
    statusCode: 503,
  });
}

type EventsQuery = {
  start?: string;
  end?: string;
  publisher?: string;
  status?: string;
  projectId?: string;
};

type TimelineQuery = {
  start?: string;
  end?: string;
  publisher?: string;
  projectId?: string;
  limit?: string;
};

export async function calendarRoutes(
  app: FastifyInstance,
  options: CalendarRouteOptions,
): Promise<void> {
  const { calendarService, authMiddleware } = options;
  const preHandler = authMiddleware ? [authMiddleware.requireAuth] : [];

  app.get<{ Querystring: EventsQuery }>(
    '/calendar/events',
    { preHandler },
    async (request, reply) => {
      if (!calendarService) return serviceUnavailable(reply);

      const { start, end, publisher, status, projectId } = request.query;
      if (!start?.trim() || !end?.trim()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'start and end query parameters are required (ISO 8601)',
          statusCode: 400,
        });
      }
      if (status && !isJobStatus(status)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid status "${status}". Allowed: waiting, active, delayed, failed, completed`,
          statusCode: 400,
        });
      }

      try {
        const result = await calendarService.listEvents({
          start: start.trim(),
          end: end.trim(),
          publisher: publisher?.trim(),
          status: status?.trim(),
          projectId: projectId?.trim(),
        });
        return reply.status(200).send(result);
      } catch (err) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: err instanceof Error ? err.message : 'Invalid date range',
          statusCode: 400,
        });
      }
    },
  );

  app.get<{ Querystring: TimelineQuery }>(
    '/calendar/timeline',
    { preHandler },
    async (request, reply) => {
      if (!calendarService) return serviceUnavailable(reply);

      const { start, end, publisher, projectId, limit } = request.query;
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;

      const result = await calendarService.listTimeline({
        start: start?.trim(),
        end: end?.trim(),
        publisher: publisher?.trim(),
        projectId: projectId?.trim(),
        limit: Number.isNaN(parsedLimit ?? 0) ? undefined : parsedLimit,
      });

      return reply.status(200).send(result);
    },
  );
}

export type {
  CalendarEvent,
  CalendarEventsResult,
  CalendarTimelineResult,
  TimelineEntry,
} from '../calendar/types.js';
