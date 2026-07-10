import type { KnowledgeEdge } from '../graph/types.js';
import type { EntityReference, EntityType, KnowledgeSnapshotMetadata } from '../types.js';

/** Safe projection depth for template context assembly. */
export type KnowledgeProjectionLevel = 'identity' | 'summary' | 'full';

/** Request to assemble template-ready context from knowledge entities. */
export interface KnowledgeContextRequest {
  readonly root: EntityReference;
  readonly recipe: string;
  readonly projection?: KnowledgeProjectionLevel;
  readonly strict?: boolean;
}

/** AI-safe projected entity node included in context output. */
export interface KnowledgeContextNode {
  readonly type: EntityType;
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly projection: KnowledgeProjectionLevel;
  readonly fields?: Readonly<Record<string, unknown>>;
}

/** Warning emitted during context assembly without aborting (non-strict mode). */
export interface KnowledgeContextWarning {
  readonly code:
    | 'missing-required-type'
    | 'missing-reference'
    | 'cycle-detected'
    | 'depth-limit'
    | 'node-limit'
    | 'start-not-found'
    | 'truncated';
  readonly message: string;
  readonly entityType?: EntityType;
  readonly reference?: EntityReference;
  readonly relationship?: string;
}

/** Declarative context recipe for assembling related entities. */
export interface KnowledgeContextRecipeDefinition {
  readonly id: string;
  readonly rootEntityType: EntityType;
  readonly follow: readonly string[];
  readonly requiredEntityTypes: readonly EntityType[];
  readonly optionalEntityTypes?: readonly EntityType[];
  readonly defaultProjection: KnowledgeProjectionLevel;
  readonly maxDepth: number;
  readonly maxNodes: number;
}

/** Optional adapter policy for field projection allow/block lists. */
export interface KnowledgeProjectionPolicy {
  readonly summaryFields?: readonly string[];
  readonly blockedFields?: readonly string[];
}

/** Result of assembling template-ready context from a recipe traversal. */
export interface KnowledgeContextResult {
  readonly recipeId: string;
  readonly projection: KnowledgeProjectionLevel;
  readonly root: KnowledgeContextNode;
  readonly entitiesByType: Readonly<Partial<Record<EntityType, readonly KnowledgeContextNode[]>>>;
  readonly edges: readonly KnowledgeEdge[];
  readonly warnings: readonly KnowledgeContextWarning[];
  readonly missingRequired: readonly EntityType[];
  readonly truncated: boolean;
  readonly snapshot: KnowledgeSnapshotMetadata;
}
