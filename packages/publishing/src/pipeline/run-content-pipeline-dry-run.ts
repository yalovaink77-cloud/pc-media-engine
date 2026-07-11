import {
  type ContentReviewerIdentity,
  createContentReviewRequest,
  createContentReviewService,
  createGeneratedContentArtifact,
  createGenerationJob,
  FakeGenerationProvider,
  type FakeGenerationProviderOptions,
  type GenerationProviderAdapter,
  InMemoryContentReviewStore,
  runGenerationJob,
} from '@pcme/ai';
import {
  type ContentGenerationPlan,
  type ContentGenerationRequest,
  createCommerceContentOrchestrator,
} from '@pcme/content';
import type { ProjectScopedPersistenceContext } from '@pcme/shared';

import { createPublishingEnqueueService } from '../enqueue/publishing-enqueue.service.js';
import { createPublishingHandoff } from '../handoff/create-handoff.js';
import type { FakePublishingTargetAdapterOptions } from '../handoff/fake-adapter.js';
import { FakePublishingTargetAdapter } from '../handoff/fake-adapter.js';
import type {
  PublishingMetadata,
  PublishingTarget,
  PublishingTargetAdapter,
} from '../handoff/types.js';
import { executeDurablePublishingHandoffCycle } from '../orchestration/durable-handoff-publishing.js';
import {
  createPublishingWorker,
  InMemoryPublishingIdempotencyRepository,
  InMemoryPublishingOutboxRepository,
} from '../worker/index.js';
import type { PublishingWorkerExecutionStatus } from '../worker/types.js';
import { createDryRunCommerceFixture } from './dry-run-commerce-fixture.js';
import { ContentPipelineDryRunError } from './errors.js';
import { runTimedStage, sumStageDurations } from './timing.js';
import type {
  ContentPipelineDryRunModeOptions,
  ContentPipelineDryRunOptions,
  ContentPipelineDryRunResult,
  ContentPipelineDryRunStatus,
  ContentPipelineGenerationMode,
  ContentPipelinePublishingMode,
  ContentPipelineStageTiming,
  ContentPipelineStorageMode,
  ContentPipelineWarningCounts,
} from './types.js';

const DEFAULT_REVIEWER: ContentReviewerIdentity = Object.freeze({
  reviewerId: 'pipeline-dry-run-reviewer',
  displayName: 'Pipeline Dry Run Reviewer',
});

const DEFAULT_TARGET: PublishingTarget = Object.freeze({
  targetId: 'fake',
  platform: 'fake-platform',
  supportedFormats: Object.freeze(['markdown', 'plain-text']),
});

const DEFAULT_PUBLISHING_METADATA = Object.freeze({
  title: 'Pipeline Dry Run Draft',
  slug: 'pipeline-dry-run-draft',
  publishStatus: 'draft' as const,
});

const DEFAULT_CONTEXT: ProjectScopedPersistenceContext = Object.freeze({
  organizationId: 'pipeline-dry-run-org',
  projectId: 'pipeline-dry-run-project',
});

const DEFAULT_FAKE_CONTENT =
  '# Product review\n\nConsult a professional if unsure about aftercare choices.';

function finalizeWarningCounts(counts: {
  orchestrator: number;
  generation: number;
  artifact: number;
  review: number;
  handoff: number;
  enqueue: number;
  worker: number;
}): ContentPipelineWarningCounts {
  return Object.freeze({
    ...counts,
    total:
      counts.orchestrator +
      counts.generation +
      counts.artifact +
      counts.review +
      counts.handoff +
      counts.enqueue +
      counts.worker,
  });
}

function resolveStatus(
  warningCounts: ContentPipelineWarningCounts,
  blocked: boolean,
  failed: boolean,
): ContentPipelineDryRunStatus {
  if (failed) {
    return 'failed';
  }
  if (blocked) {
    return 'blocked';
  }
  if (warningCounts.total > 0) {
    return 'succeeded-with-warnings';
  }
  return 'succeeded';
}

function buildFailureResult(input: {
  options: ContentPipelineDryRunOptions;
  stages: readonly ContentPipelineStageTiming[];
  warningCounts: ContentPipelineWarningCounts;
  error: ContentPipelineDryRunError;
  partial?: Partial<ContentPipelineDryRunResult>;
}): ContentPipelineDryRunResult {
  return Object.freeze({
    status: 'failed',
    root: input.options.root,
    contentType: input.options.contentType,
    warningCounts: input.warningCounts,
    stages: input.stages,
    totalDurationMs: sumStageDurations(input.stages),
    error: Object.freeze({
      code: input.error.code,
      stage: input.error.stage,
      message: input.error.message,
    }),
    ...input.partial,
  });
}

function buildBlockedResult(input: {
  options: ContentPipelineDryRunOptions;
  stages: readonly ContentPipelineStageTiming[];
  warningCounts: ContentPipelineWarningCounts;
  error?: { code: string; stage: string; message: string };
  partial?: Partial<ContentPipelineDryRunResult>;
}): ContentPipelineDryRunResult {
  return Object.freeze({
    status: 'blocked',
    root: input.options.root,
    contentType: input.options.contentType,
    warningCounts: input.warningCounts,
    stages: input.stages,
    totalDurationMs: sumStageDurations(input.stages),
    error: input.error ? Object.freeze({ ...input.error }) : undefined,
    ...input.partial,
  });
}

function buildSuccessResult(input: {
  options: ContentPipelineDryRunOptions;
  stages: readonly ContentPipelineStageTiming[];
  warningCounts: ContentPipelineWarningCounts;
  partial: Partial<ContentPipelineDryRunResult>;
}): ContentPipelineDryRunResult {
  const status = resolveStatus(input.warningCounts, false, false);
  return Object.freeze({
    status,
    root: input.options.root,
    contentType: input.options.contentType,
    warningCounts: input.warningCounts,
    stages: input.stages,
    totalDurationMs: sumStageDurations(input.stages),
    ...input.partial,
  });
}

async function resolveGenerationProvider(
  mode: ContentPipelineGenerationMode,
  fakeOptions?: FakeGenerationProviderOptions,
  override?: GenerationProviderAdapter,
): Promise<GenerationProviderAdapter> {
  if (override) {
    return override;
  }

  if (mode === 'fake') {
    return new FakeGenerationProvider({
      generatedContent: DEFAULT_FAKE_CONTENT,
      ...fakeOptions,
    });
  }

  const apiKey = process.env['OPENROUTER_API_KEY']?.trim();
  if (!apiKey) {
    throw new ContentPipelineDryRunError(
      'mode-unavailable',
      'generation-provider',
      'OpenRouter generation mode requires OPENROUTER_API_KEY',
    );
  }

  const { createOpenRouterGenerationProvider } = await import('@pcme/provider-ai-openrouter');
  return createOpenRouterGenerationProvider(process.env);
}

const WORDPRESS_PLUGIN_MODULE = '@pcme/plugin-wordpress';

interface WordPressPublishingPluginModule {
  createWordPressPublishingTargetAdapter: (
    env: NodeJS.ProcessEnv,
    options: { forceDraft: boolean },
  ) => PublishingTargetAdapter;
}

async function loadWordPressPublishingPlugin(): Promise<WordPressPublishingPluginModule> {
  return (await import(WORDPRESS_PLUGIN_MODULE)) as WordPressPublishingPluginModule;
}

function hasWordPressHandoffCredentialsInEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const url = (env['WORDPRESS_URL'] ?? env['WORDPRESS_BASE_URL'] ?? '').trim();
  const username = (env['WORDPRESS_USERNAME'] ?? '').trim();
  const appPassword = (env['WORDPRESS_APP_PASSWORD'] ?? '').trim();
  return Boolean(url && username && appPassword);
}

async function resolvePublishingAdapter(
  mode: ContentPipelinePublishingMode,
  fakeOptions?: FakePublishingTargetAdapterOptions,
  override?: PublishingTargetAdapter,
): Promise<PublishingTargetAdapter> {
  if (override) {
    return override;
  }

  if (mode === 'fake') {
    return new FakePublishingTargetAdapter(fakeOptions);
  }

  if (!hasWordPressHandoffCredentialsInEnv(process.env)) {
    throw new ContentPipelineDryRunError(
      'mode-unavailable',
      'publishing-adapter',
      'WordPress draft mode requires WordPress handoff credentials',
    );
  }

  const { createWordPressPublishingTargetAdapter } = await loadWordPressPublishingPlugin();

  return createWordPressPublishingTargetAdapter(process.env, { forceDraft: true });
}

async function resolvePublishingStorage(
  mode: ContentPipelineStorageMode,
  context: ProjectScopedPersistenceContext,
): Promise<{
  outboxRepository:
    InMemoryPublishingOutboxRepository | import('@pcme/database').PrismaPublishingOutboxRepository;
  idempotencyRepository:
    | InMemoryPublishingIdempotencyRepository
    | import('@pcme/database').PrismaPublishingIdempotencyRepository;
}> {
  if (mode === 'in-memory') {
    return {
      outboxRepository: new InMemoryPublishingOutboxRepository(),
      idempotencyRepository: new InMemoryPublishingIdempotencyRepository(),
    };
  }

  const databaseUrl = process.env['DATABASE_URL']?.trim();
  const organizationId = process.env['PCME_DEFAULT_ORG_ID']?.trim();
  const projectId = process.env['PCME_DEFAULT_PROJECT_ID']?.trim();
  if (!databaseUrl || !organizationId || !projectId) {
    throw new ContentPipelineDryRunError(
      'mode-unavailable',
      'publishing-storage',
      'Durable database mode requires DATABASE_URL, PCME_DEFAULT_ORG_ID, and PCME_DEFAULT_PROJECT_ID',
    );
  }

  if (context.organizationId !== organizationId || context.projectId !== projectId) {
    throw new ContentPipelineDryRunError(
      'mode-unavailable',
      'publishing-storage',
      'Durable database mode persistence context must match configured org/project scope',
    );
  }

  const {
    getPrismaClient,
    PrismaPublishingIdempotencyRepository,
    PrismaPublishingOutboxRepository,
  } = await import('@pcme/database');
  const client = getPrismaClient();
  return {
    outboxRepository: new PrismaPublishingOutboxRepository(client),
    idempotencyRepository: new PrismaPublishingIdempotencyRepository(client),
  };
}

function buildGenerationRequest(options: ContentPipelineDryRunOptions): ContentGenerationRequest {
  return Object.freeze({
    root: options.root,
    contextRecipe: options.contextRecipe,
    contentType: options.contentType,
    locale: options.locale ?? 'en',
    tone: options.tone ?? 'educational',
    outputFormat: options.outputFormat ?? 'markdown',
    strict: options.strict ?? false,
  });
}

/** Execute the full PCME content pipeline in offline dry-run mode. */
export async function runContentPipelineDryRun(
  options: ContentPipelineDryRunOptions,
): Promise<ContentPipelineDryRunResult> {
  const stages: ContentPipelineStageTiming[] = [];
  const warningCounts = {
    orchestrator: 0,
    generation: 0,
    artifact: 0,
    review: 0,
    handoff: 0,
    enqueue: 0,
    worker: 0,
  };
  const mode: Required<ContentPipelineDryRunModeOptions> = Object.freeze({
    generation: options.mode?.generation ?? 'fake',
    publishing: options.mode?.publishing ?? 'fake',
    storage: options.mode?.storage ?? 'in-memory',
  });
  const persistenceContext = options.persistenceContext ?? DEFAULT_CONTEXT;
  const reviewDecision = options.reviewDecision ?? 'approve';
  let stageClock = options.now ?? new Date();

  try {
    const orchestratorTimed = await runTimedStage('orchestrator', stageClock, async () => {
      const orchestrator =
        options.orchestrator ??
        (await createCommerceContentOrchestrator({
          strict: options.strict,
          commerce: options.commerce ?? {
            repoPath: await createDryRunCommerceFixture(options.root),
          },
        }));
      return orchestrator.prepare(buildGenerationRequest(options));
    });
    stages.push(orchestratorTimed.timing);
    stageClock = new Date(orchestratorTimed.timing.completedAt);
    const plan: ContentGenerationPlan = orchestratorTimed.result;
    warningCounts.orchestrator = plan.warnings.length;

    if (plan.status === 'blocked') {
      return buildBlockedResult({
        options,
        stages,
        warningCounts: finalizeWarningCounts(warningCounts),
        error: {
          code: 'context-blocked',
          stage: 'orchestrator',
          message: plan.blockReason ?? 'Content generation plan is blocked',
        },
        partial: {
          sourceId: plan.sourceReference.sourceId,
          snapshotId: plan.snapshot.snapshotId,
          entityCount: plan.metadata.entityCount,
        },
      });
    }

    let job;
    try {
      const jobTimed = await runTimedStage('generation-job', stageClock, () =>
        Promise.resolve(createGenerationJob(plan)),
      );
      stages.push(jobTimed.timing);
      stageClock = new Date(jobTimed.timing.completedAt);
      job = jobTimed.result;
    } catch (error) {
      throw new ContentPipelineDryRunError(
        'generation-job-blocked',
        'generation-job',
        error instanceof Error ? error.message : 'Generation job creation failed',
      );
    }

    const provider = await resolveGenerationProvider(
      mode.generation,
      options.fakeProvider,
      options.generationProvider,
    );

    const generationTimed = await runTimedStage('generation-provider', stageClock, () =>
      runGenerationJob(job, provider),
    );
    stages.push(generationTimed.timing);
    stageClock = new Date(generationTimed.timing.completedAt);
    const generation = generationTimed.result;
    warningCounts.generation = generation.response?.warnings?.length ?? 0;

    if (generation.status !== 'succeeded' || !generation.response) {
      throw new ContentPipelineDryRunError(
        'provider-failure',
        'generation-provider',
        generation.error?.message ?? 'Generation provider failed',
      );
    }

    const artifactTimed = await runTimedStage('artifact', stageClock, () =>
      Promise.resolve(
        createGeneratedContentArtifact(job, generation.response!, {
          createdAt: options.fixedCreatedAt,
        }),
      ),
    );
    stages.push(artifactTimed.timing);
    stageClock = new Date(artifactTimed.timing.completedAt);
    const { artifact, validation } = artifactTimed.result;
    warningCounts.artifact = validation.warnings.length;

    if (artifact.status === 'invalid' || artifact.status === 'rejected') {
      throw new ContentPipelineDryRunError(
        'artifact-invalid',
        'artifact',
        `Generated artifact status ${artifact.status} is not publishable`,
      );
    }

    const reviewTimed = await runTimedStage('review', stageClock, () => {
      const reviewRequest = createContentReviewRequest(artifact, {
        createdAt: options.fixedCreatedAt,
      });
      const reviewStore = new InMemoryContentReviewStore();
      const reviewService = createContentReviewService(reviewStore);
      reviewStore.create(reviewRequest);
      const reviewResult = reviewService.submitDecision({
        reviewId: reviewRequest.reviewId,
        decision: reviewDecision,
        reviewer: options.reviewer ?? DEFAULT_REVIEWER,
      });
      return Promise.resolve({ reviewRequest, reviewResult });
    });
    stages.push(reviewTimed.timing);
    stageClock = new Date(reviewTimed.timing.completedAt);
    const { reviewRequest, reviewResult } = reviewTimed.result;
    warningCounts.review = reviewResult.findings.length;

    if (reviewDecision === 'reject' || reviewResult.review.status === 'rejected') {
      return buildBlockedResult({
        options,
        stages,
        warningCounts: finalizeWarningCounts(warningCounts),
        error: {
          code: 'review-failure',
          stage: 'review',
          message: 'Review decision rejected the generated artifact',
        },
        partial: {
          sourceId: plan.sourceReference.sourceId,
          snapshotId: plan.snapshot.snapshotId,
          entityCount: plan.metadata.entityCount,
          jobId: job.jobId,
          artifactId: artifact.artifactId,
          reviewId: reviewRequest.reviewId,
        },
      });
    }

    const metadata: PublishingMetadata = Object.freeze({
      ...DEFAULT_PUBLISHING_METADATA,
      ...options.publishingMetadata,
    });
    const handoffTimed = await runTimedStage('handoff', stageClock, () =>
      Promise.resolve(
        createPublishingHandoff(
          {
            artifact,
            review: reviewResult,
            target: options.publishingTarget ?? DEFAULT_TARGET,
            metadata,
          },
          { createdAt: options.fixedCreatedAt },
        ),
      ),
    );
    stages.push(handoffTimed.timing);
    stageClock = new Date(handoffTimed.timing.completedAt);
    const handoff = handoffTimed.result;
    warningCounts.handoff = handoff.package.warnings.length;

    if (handoff.package.status !== 'ready') {
      return buildBlockedResult({
        options,
        stages,
        warningCounts: finalizeWarningCounts(warningCounts),
        error: {
          code: 'handoff-blocked',
          stage: 'handoff',
          message: `Handoff status ${handoff.package.status} is not ready for enqueue`,
        },
        partial: {
          sourceId: plan.sourceReference.sourceId,
          snapshotId: plan.snapshot.snapshotId,
          entityCount: plan.metadata.entityCount,
          jobId: job.jobId,
          artifactId: artifact.artifactId,
          reviewId: reviewRequest.reviewId,
          handoffId: handoff.package.handoffId,
          targetId: handoff.package.target.targetId,
        },
      });
    }

    const storage = await resolvePublishingStorage(mode.storage, persistenceContext);
    const publishingAdapter = await resolvePublishingAdapter(
      mode.publishing,
      options.fakePublisher,
      options.publishingAdapter,
    );
    const enqueueService =
      options.enqueueService ??
      createPublishingEnqueueService({
        context: persistenceContext,
        outboxRepository: storage.outboxRepository,
      });
    const worker =
      options.worker ??
      createPublishingWorker({
        context: persistenceContext,
        outboxRepository: storage.outboxRepository,
        idempotencyRepository: storage.idempotencyRepository,
        adapters: [publishingAdapter],
        workerId: 'pipeline-dry-run-worker',
      });

    const publishTimed = await runTimedStage('enqueue-worker', stageClock, () =>
      executeDurablePublishingHandoffCycle({
        context: persistenceContext,
        handoff: handoff.package,
        enqueueService,
        worker,
        now: options.now,
      }),
    );
    stages.push(publishTimed.timing);
    const { enqueue, worker: workerResult } = publishTimed.result;
    warningCounts.enqueue = enqueue.warnings.length;
    warningCounts.worker = workerResult.warnings?.length ?? 0;

    if (enqueue.status === 'rejected') {
      throw new ContentPipelineDryRunError(
        'enqueue-failure',
        'enqueue',
        'Publishing enqueue rejected the handoff package',
      );
    }

    const workerStatus: PublishingWorkerExecutionStatus = workerResult.executionStatus;
    if (workerStatus !== 'succeeded' && workerStatus !== 'idle') {
      throw new ContentPipelineDryRunError(
        'worker-failure',
        'worker',
        `Worker execution ended with status ${workerStatus}`,
      );
    }

    return buildSuccessResult({
      options,
      stages,
      warningCounts: finalizeWarningCounts(warningCounts),
      partial: {
        sourceId: plan.sourceReference.sourceId,
        snapshotId: plan.snapshot.snapshotId,
        entityCount: plan.metadata.entityCount,
        jobId: job.jobId,
        artifactId: artifact.artifactId,
        reviewId: reviewRequest.reviewId,
        handoffId: handoff.package.handoffId,
        outboxId: enqueue.outboxId,
        workerStatus,
        targetId: handoff.package.target.targetId,
      },
    });
  } catch (error) {
    if (error instanceof ContentPipelineDryRunError) {
      if (error.code === 'mode-unavailable') {
        return buildFailureResult({
          options,
          stages,
          warningCounts: finalizeWarningCounts(warningCounts),
          error,
        });
      }

      return buildFailureResult({
        options,
        stages,
        warningCounts: finalizeWarningCounts(warningCounts),
        error,
      });
    }

    return buildFailureResult({
      options,
      stages,
      warningCounts: finalizeWarningCounts(warningCounts),
      error: new ContentPipelineDryRunError(
        'knowledge-load-failure',
        stages.at(-1)?.stage ?? 'pipeline',
        error instanceof Error ? error.message : 'Pipeline dry run failed',
      ),
    });
  }
}

export { DEFAULT_FAKE_CONTENT, DEFAULT_REVIEWER, DEFAULT_TARGET };
