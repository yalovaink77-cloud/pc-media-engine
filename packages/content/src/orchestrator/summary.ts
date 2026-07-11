import type { KnowledgeContextResult } from '../knowledge/context/types.js';
import type { EntityType } from '../knowledge/types.js';
import type { ContentContextSummary } from './types.js';

export function buildContextSummary(context: KnowledgeContextResult): ContentContextSummary {
  const entityCountByType: Partial<Record<EntityType, number>> = {};
  const sortedTypes = Object.keys(context.entitiesByType).sort((a, b) => a.localeCompare(b));

  for (const type of sortedTypes) {
    const nodes = context.entitiesByType[type as EntityType];
    entityCountByType[type as EntityType] = nodes?.length ?? 0;
  }

  return Object.freeze({
    recipeId: context.recipeId,
    projection: context.projection,
    entityCountByType: Object.freeze(entityCountByType),
    missingRequired: context.missingRequired,
    truncated: context.truncated,
  });
}

export function countContextEntities(context: KnowledgeContextResult): number {
  return Object.values(context.entitiesByType).reduce(
    (total, nodes) => total + (nodes?.length ?? 0),
    0,
  );
}
