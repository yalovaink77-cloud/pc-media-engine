import type { ProcessingJobAttemptRepository, ProcessingJobRepository } from '@pcme/database';

// ---------------------------------------------------------------------------
// Dependency injection types
// ---------------------------------------------------------------------------

/**
 * Minimal repository surface the no-op processor requires.
 * Using Pick lets tests pass plain objects instead of full class instances.
 */
export type ProcessorJobRepo = Pick<ProcessingJobRepository, 'findByIdGlobal' | 'update'>;

export type ProcessorAttemptRepo = Pick<
  ProcessingJobAttemptRepository,
  'nextAttemptNumber' | 'create' | 'update'
>;

export type ProcessorDeps = {
  jobRepo: ProcessorJobRepo;
  attemptRepo: ProcessorAttemptRepo;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProcessingJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`ProcessingJob not found: ${jobId}`);
    this.name = 'ProcessingJobNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// No-op processor — Sprint 11
// ---------------------------------------------------------------------------

/**
 * No-op processor for Sprint 11.
 *
 * Simulates the complete worker lifecycle without performing real media work:
 *   1. Load the ProcessingJob from the database (by ID, no project scoping).
 *   2. Mark the job as running.
 *   3. Create a ProcessingJobAttempt (status = running).
 *   4. [No-op] — real dispatch by processingType goes here in Sprint 12.
 *   5. Mark the attempt completed.
 *   6. Mark the ProcessingJob completed.
 *
 * No ProcessingArtifact is created in this sprint.
 * No file I/O is performed.
 */
export async function noopProcessor(processingJobId: string, deps: ProcessorDeps): Promise<void> {
  // 1. Load job (global — no project scope; worker is internal)
  const job = await deps.jobRepo.findByIdGlobal(processingJobId);
  if (!job) {
    throw new ProcessingJobNotFoundError(processingJobId);
  }

  // 2. Mark job running
  await deps.jobRepo.update(job.projectId, job.id, {
    status: 'running',
    startedAt: new Date(),
  });

  // 3. Determine next attempt number and create attempt
  const attemptNumber = await deps.attemptRepo.nextAttemptNumber(job.id);
  const attempt = await deps.attemptRepo.create({
    organizationId: job.organizationId,
    projectId: job.projectId,
    processingJobId: job.id,
    attemptNumber,
    status: 'running',
  });

  // 4. Record attempt start time
  await deps.attemptRepo.update(job.projectId, attempt.id, {
    startedAt: new Date(),
  });

  // Sprint 12: dispatch real processor here based on job.processingType
  // switch (job.processingType) {
  //   case 'thumbnail': await thumbnailProcessor(job, deps); break;
  //   default: throw new Error(`Unknown processingType: ${job.processingType}`);
  // }

  // 5. Mark attempt completed
  await deps.attemptRepo.update(job.projectId, attempt.id, {
    status: 'completed',
    completedAt: new Date(),
  });

  // 6. Mark job completed
  await deps.jobRepo.update(job.projectId, job.id, {
    status: 'completed',
    completedAt: new Date(),
    failureReason: null,
  });
}
