import type { KnowledgeContextRecipeDefinition } from '../knowledge/context/types.js';
import type {
  EntityReference,
  EntityType,
  KnowledgeService,
  KnowledgeSnapshotMetadata,
} from '../knowledge/types.js';
import type {
  PromptContentRecipeDefinition,
  PromptOutputFormat,
  PromptPayloadResult,
} from '../prompt/types.js';

/** Lifecycle status for a prepared content generation plan. */
export type ContentGenerationStatus = 'ready' | 'ready-with-warnings' | 'blocked';

/** Request to prepare a content generation plan without invoking AI. */
export interface ContentGenerationRequest {
  readonly root: EntityReference;
  readonly contextRecipe: string;
  readonly contentType: string;
  readonly locale?: string;
  readonly tone?: string;
  readonly outputFormat?: PromptOutputFormat;
  readonly strict?: boolean;
}

/** Normalized warning emitted during generation plan preparation. */
export interface ContentGenerationWarning {
  readonly code: string;
  readonly message: string;
  readonly source: 'snapshot' | 'context' | 'prompt' | 'orchestrator';
  readonly severity: 'info' | 'warning';
}

/** Summary of assembled knowledge context included in the plan. */
export interface ContentContextSummary {
  readonly recipeId: string;
  readonly projection: string;
  readonly entityCountByType: Readonly<Partial<Record<EntityType, number>>>;
  readonly missingRequired: readonly EntityType[];
  readonly truncated: boolean;
}

/** Metadata describing a prepared generation plan. */
export interface ContentGenerationMetadata {
  readonly requestId: string;
  readonly entityCount: number;
  readonly promptSectionCount: number;
  readonly constraintCount: number;
  readonly estimatedInputCharacters: number;
}

/** Source reference for the knowledge backing the plan. */
export interface ContentGenerationSourceReference {
  readonly sourceId: string;
  readonly sourceType: string;
}

/** Complete generation plan ready for downstream AI orchestration. */
export interface ContentGenerationPlan {
  readonly requestId: string;
  readonly status: ContentGenerationStatus;
  readonly sourceReference: ContentGenerationSourceReference;
  readonly snapshot: KnowledgeSnapshotMetadata;
  readonly root: EntityReference;
  readonly contextRecipeId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly tone: string;
  readonly outputFormat: PromptOutputFormat;
  readonly contextSummary: ContentContextSummary;
  readonly promptPayload?: PromptPayloadResult;
  readonly warnings: readonly ContentGenerationWarning[];
  readonly metadata: ContentGenerationMetadata;
  readonly createdAt: string;
  readonly blockReason?: string;
}

/** Options for creating a content orchestrator instance. */
export interface ContentOrchestratorOptions {
  readonly knowledgeService: KnowledgeService;
  readonly contextRecipes?: readonly KnowledgeContextRecipeDefinition[];
  readonly promptRecipes?: readonly PromptContentRecipeDefinition[];
  readonly requestIdGenerator?: (input: {
    request: ContentGenerationRequest;
    sourceKey: string;
  }) => string;
}

/** Generic content orchestrator contract. */
export interface ContentOrchestrator {
  prepare(request: ContentGenerationRequest): Promise<ContentGenerationPlan>;
}

/** Commerce-specific orchestrator factory options. */
export interface CommerceContentOrchestratorOptions {
  readonly strict?: boolean;
  readonly commerce?: import('../knowledge/types.js').CommerceKnowledgeAdapterOptions;
}

export type ContentGenerationBlockCode =
  | 'missing-root-entity'
  | 'missing-required-context'
  | 'unsupported-content-type'
  | 'unsupported-context-recipe'
  | 'incompatible-recipe-content'
  | 'truncated-context-strict'
  | 'unsafe-recipe-policy';
