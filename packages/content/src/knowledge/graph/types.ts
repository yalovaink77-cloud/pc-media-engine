import type {
  EntityReference,
  EntityType,
  IncrementalKnowledgeSourceAdapter,
  KnowledgeEntity,
} from '../types.js';

/** Default and hard limits for graph traversal depth. */
export const DEFAULT_MAX_TRAVERSAL_DEPTH = 3;
export const HARD_MAX_TRAVERSAL_DEPTH = 5;

/** Default and hard limits for nodes collected during traversal. */
export const DEFAULT_MAX_TRAVERSAL_NODES = 100;
export const HARD_MAX_TRAVERSAL_NODES = 500;

/** Directed edge between two knowledge entities. */
export interface KnowledgeEdge {
  readonly from: EntityReference;
  readonly to: EntityReference;
  readonly relationship: string;
}

/** Warning emitted during traversal without aborting (non-strict mode). */
export interface KnowledgeTraversalWarning {
  readonly code:
    'missing-reference' | 'cycle-detected' | 'depth-limit' | 'node-limit' | 'start-not-found';
  readonly message: string;
  readonly reference?: EntityReference;
  readonly relationship?: string;
}

/** Request for bounded relationship traversal from a start entity. */
export interface KnowledgeTraversalRequest {
  readonly start: EntityReference;
  /** Named relationships to follow, e.g. `brand.products`. */
  readonly follow: readonly string[];
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  /** When true, missing references throw instead of warning. */
  readonly strict?: boolean;
}

/** Result of a bounded graph traversal. */
export interface KnowledgeTraversalResult {
  readonly snapshotId: string;
  readonly start: EntityReference;
  readonly nodes: readonly KnowledgeEntity[];
  readonly edges: readonly KnowledgeEdge[];
  readonly truncated: boolean;
  readonly warnings: readonly KnowledgeTraversalWarning[];
}

/** Declarative relationship edge in a source adapter manifest. */
export interface KnowledgeRelationshipDefinition {
  /** Full relationship name: `${sourceType}.${relation}`. */
  readonly name: string;
  readonly sourceType: EntityType;
  /** Short relation key used for indexing. */
  readonly relation: string;
  readonly targetType: EntityType;
  /** Source field containing scalar or string array foreign keys. */
  readonly field: string;
}

/** Adapter extension that supplies relationship manifests for graph traversal. */
export interface GraphKnowledgeSourceAdapter extends IncrementalKnowledgeSourceAdapter {
  getRelationshipManifest(): readonly KnowledgeRelationshipDefinition[];
}
