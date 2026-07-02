import type { PrismaClient, ProcessingJobAttempt, ProcessingStatus } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import { requireProjectId } from './scoped-query.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export type CreateProcessingJobAttemptInput = {
  organizationId: string;
  projectId: string;
  processingJobId: string;
  attemptNumber: number;
  status?: ProcessingStatus;
};

export type UpdateProcessingJobAttemptInput = {
  status?: ProcessingStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failureReason?: string | null;
};

// ---------------------------------------------------------------------------
// ProcessingJobAttemptRepository
// ---------------------------------------------------------------------------

export class ProcessingJobAttemptRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  create(input: CreateProcessingJobAttemptInput): Promise<ProcessingJobAttempt> {
    if (input.attemptNumber < 1) {
      throw new Error('attemptNumber must be >= 1');
    }

    return this.client.processingJobAttempt.create({
      data: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        processingJobId: input.processingJobId,
        attemptNumber: input.attemptNumber,
        status: input.status ?? 'pending',
      },
    });
  }

  update(
    projectId: string,
    attemptId: string,
    input: UpdateProcessingJobAttemptInput,
  ): Promise<ProcessingJobAttempt | null> {
    return this.client.processingJobAttempt
      .updateMany({
        where: {
          id: attemptId,
          projectId: requireProjectId(projectId),
        },
        data: {
          status: input.status,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          failureReason: input.failureReason,
        },
      })
      .then((result) =>
        result.count === 0
          ? null
          : this.client.processingJobAttempt.findUnique({ where: { id: attemptId } }),
      );
  }

  listByJob(projectId: string, processingJobId: string): Promise<ProcessingJobAttempt[]> {
    return this.client.processingJobAttempt.findMany({
      where: {
        processingJobId,
        projectId: requireProjectId(projectId),
      },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  /**
   * Returns the next sequential attempt number for a given job.
   * Safe to call concurrently — the unique constraint on (processingJobId, attemptNumber)
   * ensures only one attempt can be inserted for each number.
   */
  async nextAttemptNumber(processingJobId: string): Promise<number> {
    const last = await this.client.processingJobAttempt.findFirst({
      where: { processingJobId },
      orderBy: { attemptNumber: 'desc' },
      select: { attemptNumber: true },
    });
    return (last?.attemptNumber ?? 0) + 1;
  }
}
