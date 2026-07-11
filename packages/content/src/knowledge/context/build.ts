import { KnowledgeEntityNotFoundError } from '../errors.js';
import type { KnowledgeTraversalResult, KnowledgeTraversalWarning } from '../graph/types.js';
import type { EntityType, KnowledgeSnapshotMetadata } from '../types.js';
import { projectKnowledgeEntity } from './projection.js';
import type {
  KnowledgeContextNode,
  KnowledgeContextRecipeDefinition,
  KnowledgeContextRequest,
  KnowledgeContextResult,
  KnowledgeContextWarning,
  KnowledgeProjectionLevel,
  KnowledgeProjectionPolicy,
} from './types.js';

function toContextWarning(warning: KnowledgeTraversalWarning): KnowledgeContextWarning {
  return Object.freeze({
    code:
      warning.code === 'node-limit'
        ? 'truncated'
        : warning.code === 'missing-reference'
          ? 'missing-reference'
          : warning.code,
    message: warning.message,
    reference: warning.reference,
    relationship: warning.relationship,
  });
}

function groupNodesByType(
  nodes: readonly KnowledgeContextNode[],
): Readonly<Partial<Record<EntityType, readonly KnowledgeContextNode[]>>> {
  const grouped = new Map<EntityType, KnowledgeContextNode[]>();

  for (const node of nodes) {
    const existing = grouped.get(node.type) ?? [];
    existing.push(node);
    grouped.set(node.type, existing);
  }

  const sortedTypes = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  const result: Partial<Record<EntityType, readonly KnowledgeContextNode[]>> = {};

  for (const type of sortedTypes) {
    const entries = grouped.get(type) ?? [];
    result[type] = Object.freeze(
      [...entries].sort((a, b) => a.id.localeCompare(b.id)),
    ) as readonly KnowledgeContextNode[];
  }

  return Object.freeze(result);
}

function findMissingRequiredTypes(
  recipe: KnowledgeContextRecipeDefinition,
  entitiesByType: Readonly<Partial<Record<EntityType, readonly KnowledgeContextNode[]>>>,
): readonly EntityType[] {
  const missing: EntityType[] = [];

  for (const entityType of recipe.requiredEntityTypes) {
    const entities = entitiesByType[entityType];
    if (!entities || entities.length === 0) {
      missing.push(entityType);
    }
  }

  return Object.freeze([...missing].sort((a, b) => a.localeCompare(b)));
}

export interface BuildKnowledgeContextInput {
  recipe: KnowledgeContextRecipeDefinition;
  request: KnowledgeContextRequest;
  projection: KnowledgeProjectionLevel;
  traversal: KnowledgeTraversalResult;
  snapshot: KnowledgeSnapshotMetadata;
  policy?: KnowledgeProjectionPolicy;
}

/** Assemble a deterministic, AI-safe context result from a traversal. */
export function buildKnowledgeContext(input: BuildKnowledgeContextInput): KnowledgeContextResult {
  const { recipe, request, projection, traversal, snapshot, policy } = input;

  const projectedNodes = traversal.nodes.map((node) =>
    projectKnowledgeEntity(node, projection, policy),
  );
  const entitiesByType = groupNodesByType(projectedNodes);
  const rootEntity = traversal.nodes.find(
    (node) => node.type === request.root.type && node.id === request.root.id,
  );

  if (!rootEntity) {
    throw new KnowledgeEntityNotFoundError(request.root);
  }

  const root = projectKnowledgeEntity(rootEntity, projection, policy);

  const missingRequired = findMissingRequiredTypes(recipe, entitiesByType);
  const warnings: KnowledgeContextWarning[] = traversal.warnings.map(toContextWarning);

  for (const entityType of missingRequired) {
    warnings.push(
      Object.freeze({
        code: 'missing-required-type',
        message: `Required entity type missing from context: ${entityType}`,
        entityType,
      }),
    );
  }

  if (traversal.truncated) {
    warnings.push(
      Object.freeze({
        code: 'truncated',
        message: 'Context traversal was truncated by node limits',
      }),
    );
  }

  const sortedWarnings = Object.freeze(
    [...warnings].sort((a, b) => {
      const codeOrder = a.code.localeCompare(b.code);
      if (codeOrder !== 0) {
        return codeOrder;
      }
      const typeOrder = (a.entityType ?? '').localeCompare(b.entityType ?? '');
      if (typeOrder !== 0) {
        return typeOrder;
      }
      return a.message.localeCompare(b.message);
    }),
  );

  return Object.freeze({
    recipeId: recipe.id,
    projection,
    root,
    entitiesByType,
    edges: traversal.edges,
    warnings: sortedWarnings,
    missingRequired,
    truncated: traversal.truncated,
    snapshot: Object.freeze({
      snapshotId: snapshot.snapshotId,
      sourceId: snapshot.sourceId,
      sourceType: snapshot.sourceType,
      sourcePath: snapshot.sourcePath,
      createdAt: snapshot.createdAt,
      entityCounts: snapshot.entityCounts,
      warnings: snapshot.warnings,
    }),
  });
}
