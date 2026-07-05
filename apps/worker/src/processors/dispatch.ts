import type { ProcessingJobAttemptRepository, ProcessingJobRepository } from '@pcme/database';
import type { StorageProvider } from '@pcme/media';

import type { ThumbnailCompleteContext } from '../pipeline/post-thumbnail.js';
import type { ThumbnailArtifactRepo, ThumbnailAssetRepo } from './thumbnail.processor.js';
import { buildThumbnailKey, thumbnailProcessor } from './thumbnail.processor.js';

export { ProcessingJobNotFoundError } from './noop.processor.js';

// ---------------------------------------------------------------------------
// Dependency injection types
// ---------------------------------------------------------------------------

export type DispatchJobRepo = Pick<ProcessingJobRepository, 'findByIdGlobal' | 'update'>;
export type DispatchAttemptRepo = Pick<
  ProcessingJobAttemptRepository,
  'nextAttemptNumber' | 'create' | 'update'
>;

export type DispatchDeps = {
  jobRepo: DispatchJobRepo;
  attemptRepo: DispatchAttemptRepo;
  assetRepo: ThumbnailAssetRepo;
  storageProvider: Pick<StorageProvider, 'get' | 'put'>;
  artifactRepo: ThumbnailArtifactRepo;
  /** Sprint 21 — optional hook after successful thumbnail generation. */
  onThumbnailComplete?: (ctx: ThumbnailCompleteContext) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch a ProcessingJob to its type-specific processor.
 *
 * Handles the common lifecycle for every job type:
 *   1. Load job from DB (no project scope).
 *   2. Mark job running.
 *   3. Create a ProcessingJobAttempt (running).
 *   4. Delegate to the correct processor based on processingType.
 *   5. On success: mark attempt + job completed.
 *   6. On failure: mark attempt + job failed, record failureReason, re-throw.
 *
 * BullMQ will see re-thrown errors and mark the queue job as failed.
 */
export async function dispatchJob(processingJobId: string, deps: DispatchDeps): Promise<void> {
  // 1. Load job
  const job = await deps.jobRepo.findByIdGlobal(processingJobId);
  if (!job) {
    throw new Error(`ProcessingJob not found: ${processingJobId}`);
  }

  // 2. Mark job running
  await deps.jobRepo.update(job.projectId, job.id, {
    status: 'running',
    startedAt: new Date(),
  });

  // 3. Create attempt
  const attemptNumber = await deps.attemptRepo.nextAttemptNumber(job.id);
  const attempt = await deps.attemptRepo.create({
    organizationId: job.organizationId,
    projectId: job.projectId,
    processingJobId: job.id,
    attemptNumber,
    status: 'running',
  });
  await deps.attemptRepo.update(job.projectId, attempt.id, {
    startedAt: new Date(),
  });

  try {
    // 4. Dispatch to type-specific processor
    switch (job.processingType) {
      case 'thumbnail':
        await thumbnailProcessor(job, {
          assetRepo: deps.assetRepo,
          storageProvider: deps.storageProvider,
          artifactRepo: deps.artifactRepo,
        });
        if (deps.onThumbnailComplete) {
          const asset = await deps.assetRepo.findByIdGlobal(job.assetId);
          if (asset) {
            await deps.onThumbnailComplete({
              asset: { filename: asset.filename, storageKey: asset.storageKey },
              thumbnailKey: buildThumbnailKey(asset.storageKey),
            });
          }
        }
        break;

      default:
        // Unknown type — log a warning, treat as completed (no-op fallback)
        console.warn(
          `[dispatch] Unknown processingType: ${job.processingType} — completing as no-op`,
        );
    }

    // 5. Mark attempt + job completed
    await deps.attemptRepo.update(job.projectId, attempt.id, {
      status: 'completed',
      completedAt: new Date(),
    });

    await deps.jobRepo.update(job.projectId, job.id, {
      status: 'completed',
      completedAt: new Date(),
      failureReason: null,
    });
  } catch (err) {
    // 6. Mark attempt + job failed
    const reason = err instanceof Error ? err.message : String(err);

    await deps.attemptRepo.update(job.projectId, attempt.id, {
      status: 'failed',
      completedAt: new Date(),
      failureReason: reason,
    });

    await deps.jobRepo.update(job.projectId, job.id, {
      status: 'failed',
      completedAt: new Date(),
      failureReason: reason,
    });

    throw err;
  }
}
