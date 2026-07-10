export type { BuildKnowledgeContextInput } from './build.js';
export { buildKnowledgeContext } from './build.js';
export { containsBlockedProjectionData, projectKnowledgeEntity } from './projection.js';
export { buildContextRecipeIndex, getContextRecipe } from './recipe.js';
export type {
  KnowledgeContextNode,
  KnowledgeContextRecipeDefinition,
  KnowledgeContextRequest,
  KnowledgeContextResult,
  KnowledgeContextWarning,
  KnowledgeProjectionLevel,
  KnowledgeProjectionPolicy,
} from './types.js';

import type { GraphKnowledgeSourceAdapter } from '../graph/types.js';
import type { KnowledgeSourceAdapter } from '../types.js';
import type { KnowledgeContextRecipeDefinition, KnowledgeProjectionPolicy } from './types.js';

/** Adapter extension that supplies context recipes for template assembly. */
export interface ContextKnowledgeSourceAdapter extends GraphKnowledgeSourceAdapter {
  getContextRecipes(): readonly KnowledgeContextRecipeDefinition[];
  getProjectionPolicy?(): KnowledgeProjectionPolicy;
}

export function isContextKnowledgeSourceAdapter(
  adapter: KnowledgeSourceAdapter,
): adapter is ContextKnowledgeSourceAdapter {
  return (
    'getRelationshipManifest' in adapter &&
    typeof adapter.getRelationshipManifest === 'function' &&
    'getContextRecipes' in adapter &&
    typeof adapter.getContextRecipes === 'function'
  );
}
