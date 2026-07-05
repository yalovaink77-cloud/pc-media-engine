import { Queue } from 'bullmq';

import { parseEnvFlag } from '../env-flags.js';
import { PROCESSING_QUEUE } from './names.js';
import type { ProcessingEnqueuer } from './processing-enqueue.js';
import { createProcessingEnqueuer } from './processing-enqueue.js';

export function parseRedisConnection(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
  };
}

export function buildProcessingEnqueuer(
  redisUrl: string | undefined,
  autoEnqueue: boolean,
): ProcessingEnqueuer | undefined {
  if (!autoEnqueue || !redisUrl) {
    return undefined;
  }

  const connection = parseRedisConnection(redisUrl);
  const queue = new Queue(PROCESSING_QUEUE, { connection });

  return createProcessingEnqueuer(async (_queueName, payload) => {
    await queue.add('process', payload);
  });
}

export function shouldAutoEnqueueProcessing(env: Record<string, string | undefined>): boolean {
  return parseEnvFlag(env['PCME_AUTO_ENQUEUE_PROCESSING']);
}
