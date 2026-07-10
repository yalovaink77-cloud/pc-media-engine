export {
  buildRelationshipManifestIndex,
  extractRelationshipTargetIds,
  getRelationshipsForSourceType,
  parseRelationshipName,
  relationKey,
  resolveRelationshipTargets,
  validateRelationshipManifest,
} from './manifest.js';
export type { TraversalContext } from './traverse.js';
export { traverseKnowledgeGraph } from './traverse.js';
export type {
  GraphKnowledgeSourceAdapter,
  KnowledgeEdge,
  KnowledgeRelationshipDefinition,
  KnowledgeTraversalRequest,
  KnowledgeTraversalResult,
  KnowledgeTraversalWarning,
} from './types.js';
export {
  DEFAULT_MAX_TRAVERSAL_DEPTH,
  DEFAULT_MAX_TRAVERSAL_NODES,
  HARD_MAX_TRAVERSAL_DEPTH,
  HARD_MAX_TRAVERSAL_NODES,
} from './types.js';
