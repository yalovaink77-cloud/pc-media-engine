/** Lifecycle status for a content pipeline dry run. */
export type ContentPipelineDryRunStatus =
  'succeeded' | 'succeeded-with-warnings' | 'blocked' | 'failed';

/** Supported generation provider modes for dry runs. */
export type ContentPipelineGenerationMode = 'fake' | 'openrouter';

/** Supported publishing adapter modes for dry runs. */
export type ContentPipelinePublishingMode = 'fake' | 'wordpress-draft';

/** Supported storage modes for dry runs. */
export type ContentPipelineStorageMode = 'in-memory' | 'durable-database';

/** Timing metadata for a single pipeline stage. */
export interface ContentPipelineStageTiming {
  readonly stage: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

/** Warning counts grouped by pipeline layer. */
export interface ContentPipelineWarningCounts {
  readonly orchestrator: number;
  readonly generation: number;
  readonly artifact: number;
  readonly review: number;
  readonly handoff: number;
  readonly enqueue: number;
  readonly worker: number;
  readonly total: number;
}

/** Safe metadata returned by a content pipeline dry run. */
export interface ContentPipelineDryRunResult {
  readonly status: ContentPipelineDryRunStatus;
  readonly root: import('@pcme/content').EntityReference;
  readonly contentType: string;
  readonly sourceId?: string;
  readonly snapshotId?: string;
  readonly entityCount?: number;
  readonly jobId?: string;
  readonly artifactId?: string;
  readonly reviewId?: string;
  readonly handoffId?: string;
  readonly outboxId?: string;
  readonly workerStatus?: import('../worker/types.js').PublishingWorkerExecutionStatus;
  readonly targetId?: string;
  readonly warningCounts: ContentPipelineWarningCounts;
  readonly stages: readonly ContentPipelineStageTiming[];
  readonly totalDurationMs: number;
  readonly error?: {
    readonly code: string;
    readonly stage: string;
    readonly message: string;
  };
}

/** Optional mode overrides for a content pipeline dry run. */
export interface ContentPipelineDryRunModeOptions {
  readonly generation?: ContentPipelineGenerationMode;
  readonly publishing?: ContentPipelinePublishingMode;
  readonly storage?: ContentPipelineStorageMode;
}

/** Options for running a full offline content pipeline dry run. */
export interface ContentPipelineDryRunOptions {
  readonly root: import('@pcme/content').EntityReference;
  readonly contextRecipe: string;
  readonly contentType: string;
  readonly locale?: string;
  readonly tone?: string;
  readonly outputFormat?: import('@pcme/content').PromptOutputFormat;
  readonly strict?: boolean;
  readonly mode?: ContentPipelineDryRunModeOptions;
  readonly persistenceContext?: import('@pcme/shared').ProjectScopedPersistenceContext;
  readonly publishingTarget?: import('../handoff/types.js').PublishingTarget;
  readonly publishingMetadata?: import('../handoff/types.js').PublishingMetadata;
  readonly reviewer?: import('@pcme/ai').ContentReviewerIdentity;
  readonly reviewDecision?: import('@pcme/shared').ContentReviewDecision;
  readonly fakeProvider?: import('@pcme/ai').FakeGenerationProviderOptions;
  readonly fakePublisher?: import('../handoff/fake-adapter.js').FakePublishingTargetAdapterOptions;
  readonly fixedCreatedAt?: string;
  readonly now?: Date;
  readonly orchestrator?: import('@pcme/content').ContentOrchestrator;
  readonly commerce?: import('@pcme/content').CommerceKnowledgeAdapterOptions;
  readonly generationProvider?: import('@pcme/ai').GenerationProviderAdapter;
  readonly publishingAdapter?: import('../handoff/types.js').PublishingTargetAdapter;
  readonly enqueueService?: import('../enqueue/types.js').PublishingEnqueueService;
  readonly worker?: import('../worker/types.js').PublishingWorker;
}
