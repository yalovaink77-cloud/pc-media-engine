import type { ProcessingType } from '@pcme/database';

/**
 * Processing Orchestrator — Sprint 10.
 *
 * Schedules ProcessingJob records after a media asset is created.
 *
 * This module does NOT:
 *   - execute processing (no workers, no queues, no Sharp, no FFmpeg)
 *   - create ProcessingJobAttempt records
 *   - create ProcessingArtifact records
 *
 * It only writes ProcessingJob rows with status = 'pending' and deduplicates
 * using the unique constraint on (assetId, processingType).
 *
 * Sprint 11 should introduce a worker or queue consumer that polls/subscribes
 * for pending jobs and executes them.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default processing types scheduled for every uploaded asset.
 * Extend this list when new pipeline stages are added.
 */
export const DEFAULT_PROCESSING_TYPES: readonly ProcessingType[] = ['thumbnail'];

// ---------------------------------------------------------------------------
// Injection interface (minimal — tests pass plain objects)
// ---------------------------------------------------------------------------

/** Shape returned for each scheduled job. */
export type ScheduledJob = {
  id: string;
  processingType: string;
  status: string;
};

/** Input required to create a single processing job. */
export type CreateJobInput = {
  organizationId: string;
  projectId: string;
  assetId: string;
  processingType: ProcessingType;
};

/**
 * Minimal interface the orchestrator needs from a processing job repository.
 * Allows passing real `ProcessingJobRepository` or a mock in tests.
 */
export interface JobScheduler {
  findByAssetAndType(
    projectId: string,
    assetId: string,
    processingType: ProcessingType,
  ): Promise<ScheduledJob | null>;
  create(input: CreateJobInput): Promise<ScheduledJob>;
}

// ---------------------------------------------------------------------------
// Context passed per upload
// ---------------------------------------------------------------------------

export type OrchestrationContext = {
  organizationId: string;
  projectId: string;
  assetId: string;
};

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Schedule the default ProcessingJob records for a newly created asset.
 *
 * For each processing type in `processingTypes`:
 *   - Check if a job already exists for (projectId, assetId, processingType).
 *   - If yes: include the existing job in the result (idempotent).
 *   - If no: create a new job with status = 'pending'.
 *
 * Returns the full list of jobs (created + pre-existing) in insertion order.
 * Never throws on duplicate — the unique constraint is the source of truth.
 */
export async function scheduleDefaultJobs(
  scheduler: JobScheduler,
  context: OrchestrationContext,
  processingTypes: readonly ProcessingType[] = DEFAULT_PROCESSING_TYPES,
): Promise<ScheduledJob[]> {
  const results: ScheduledJob[] = [];

  for (const processingType of processingTypes) {
    const existing = await scheduler.findByAssetAndType(
      context.projectId,
      context.assetId,
      processingType,
    );

    if (existing !== null) {
      results.push(existing);
      continue;
    }

    const job = await scheduler.create({
      organizationId: context.organizationId,
      projectId: context.projectId,
      assetId: context.assetId,
      processingType,
    });

    results.push(job);
  }

  return results;
}
