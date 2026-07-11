import type { ProjectScopedPersistenceContext } from '@pcme/shared';

import type {
  PublishingEnqueueOptions,
  PublishingEnqueueResult,
  PublishingEnqueueService,
} from '../enqueue/types.js';
import type { PublishingHandoffPackage } from '../handoff/types.js';
import type { PublishingWorker, PublishingWorkerResult } from '../worker/types.js';

/** Execute the durable publishing flow: enqueue → worker runOnce. */
export async function executeDurablePublishingHandoffCycle(input: {
  readonly context: ProjectScopedPersistenceContext;
  readonly handoff: PublishingHandoffPackage;
  readonly enqueueService: PublishingEnqueueService;
  readonly worker: PublishingWorker;
  readonly enqueueOptions?: PublishingEnqueueOptions;
  readonly now?: Date;
}): Promise<{
  readonly enqueue: PublishingEnqueueResult;
  readonly worker: PublishingWorkerResult;
}> {
  const enqueue = await input.enqueueService.enqueue(input.handoff, {
    ...input.enqueueOptions,
    now: input.now ?? input.enqueueOptions?.now,
  });
  if (enqueue.status === 'rejected') {
    return Object.freeze({
      enqueue,
      worker: Object.freeze({
        workerId: input.worker.workerId,
        executionStatus: 'idle',
      }),
    });
  }

  const worker = await input.worker.runOnce({ now: input.now });
  return Object.freeze({ enqueue, worker });
}
