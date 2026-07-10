import { KnowledgeEntityNotFoundError, KnowledgeUnsupportedRelationshipError } from '../errors.js';
import { type KnowledgeIndexes, lookupRelationshipTargets } from '../indexes.js';
import type { EntityReference, EntityType, KnowledgeEntity } from '../types.js';
import type {
  KnowledgeEdge,
  KnowledgeRelationshipDefinition,
  KnowledgeTraversalRequest,
  KnowledgeTraversalResult,
  KnowledgeTraversalWarning,
} from './types.js';
import {
  DEFAULT_MAX_TRAVERSAL_DEPTH,
  DEFAULT_MAX_TRAVERSAL_NODES,
  HARD_MAX_TRAVERSAL_DEPTH,
  HARD_MAX_TRAVERSAL_NODES,
} from './types.js';

export interface TraversalContext {
  snapshotId: string;
  getIndexes: () => KnowledgeIndexes;
  lookupEntity: (type: EntityType, id: string) => KnowledgeEntity | undefined;
  ensureEntityType: (type: EntityType) => Promise<void>;
}

function refKey(reference: EntityReference): string {
  return `${reference.type}:${reference.id}`;
}

function sortReferences(references: readonly EntityReference[]): EntityReference[] {
  return [...references].sort((a, b) => {
    const typeOrder = a.type.localeCompare(b.type);
    if (typeOrder !== 0) {
      return typeOrder;
    }
    return a.id.localeCompare(b.id);
  });
}

function sortEdges(edges: KnowledgeEdge[]): readonly KnowledgeEdge[] {
  return Object.freeze(
    [...edges].sort((a, b) => {
      const relOrder = a.relationship.localeCompare(b.relationship);
      if (relOrder !== 0) {
        return relOrder;
      }
      const fromOrder = refKey(a.from).localeCompare(refKey(b.from));
      if (fromOrder !== 0) {
        return fromOrder;
      }
      return refKey(a.to).localeCompare(refKey(b.to));
    }),
  );
}

function sortNodes(nodes: KnowledgeEntity[]): readonly KnowledgeEntity[] {
  return Object.freeze(
    [...nodes].sort((a, b) => {
      const typeOrder = a.type.localeCompare(b.type);
      if (typeOrder !== 0) {
        return typeOrder;
      }
      return a.id.localeCompare(b.id);
    }),
  );
}

function clampDepth(requested?: number): number {
  const value = requested ?? DEFAULT_MAX_TRAVERSAL_DEPTH;
  return Math.min(Math.max(value, 0), HARD_MAX_TRAVERSAL_DEPTH);
}

function clampNodes(requested?: number): number {
  const value = requested ?? DEFAULT_MAX_TRAVERSAL_NODES;
  return Math.min(Math.max(value, 1), HARD_MAX_TRAVERSAL_NODES);
}

export async function traverseKnowledgeGraph(
  context: TraversalContext,
  manifestIndex: ReadonlyMap<string, KnowledgeRelationshipDefinition>,
  request: KnowledgeTraversalRequest,
  strict: boolean,
): Promise<KnowledgeTraversalResult> {
  const maxDepth = clampDepth(request.maxDepth);
  const maxNodes = clampNodes(request.maxNodes);
  const warnings: KnowledgeTraversalWarning[] = [];
  const edges: KnowledgeEdge[] = [];
  const nodeMap = new Map<string, KnowledgeEntity>();
  const expanded = new Set<string>();

  for (const relationshipName of request.follow) {
    if (!manifestIndex.has(relationshipName)) {
      throw new KnowledgeUnsupportedRelationshipError(relationshipName);
    }
  }

  await context.ensureEntityType(request.start.type);
  const startEntity = context.lookupEntity(request.start.type, request.start.id);
  if (!startEntity) {
    if (strict) {
      throw new KnowledgeEntityNotFoundError(request.start);
    }

    warnings.push({
      code: 'start-not-found',
      message: `Start entity not found: ${request.start.type}:${request.start.id}`,
      reference: request.start,
    });

    return Object.freeze({
      snapshotId: context.snapshotId,
      start: request.start,
      nodes: Object.freeze([]),
      edges: Object.freeze([]),
      truncated: false,
      warnings: Object.freeze(warnings),
    });
  }

  nodeMap.set(refKey(request.start), startEntity);

  type QueueItem = { reference: EntityReference; depth: number };
  const queue: QueueItem[] = [{ reference: request.start, depth: 0 }];
  let truncated = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = refKey(current.reference);

    if (expanded.has(currentKey)) {
      continue;
    }
    expanded.add(currentKey);

    if (current.depth >= maxDepth) {
      continue;
    }

    for (const relationshipName of request.follow) {
      const definition = manifestIndex.get(relationshipName);
      if (!definition || definition.sourceType !== current.reference.type) {
        continue;
      }

      await context.ensureEntityType(definition.targetType);
      const indexes = context.getIndexes();
      const targetRefs = sortReferences(
        lookupRelationshipTargets(indexes, current.reference, definition.relation),
      );

      for (const targetRef of targetRefs) {
        const targetEntity = context.lookupEntity(targetRef.type, targetRef.id);
        if (!targetEntity) {
          if (strict) {
            throw new KnowledgeEntityNotFoundError(targetRef);
          }
          warnings.push({
            code: 'missing-reference',
            message: `Missing reference: ${targetRef.type}:${targetRef.id}`,
            reference: targetRef,
            relationship: relationshipName,
          });
          continue;
        }

        edges.push(
          Object.freeze({
            from: current.reference,
            to: targetRef,
            relationship: relationshipName,
          }),
        );

        const targetKey = refKey(targetRef);
        if (nodeMap.size >= maxNodes && !nodeMap.has(targetKey)) {
          truncated = true;
          warnings.push({
            code: 'node-limit',
            message: `Traversal truncated at ${maxNodes} nodes`,
          });
          break;
        }

        if (!nodeMap.has(targetKey)) {
          nodeMap.set(targetKey, targetEntity);
        }

        if (expanded.has(targetKey)) {
          warnings.push({
            code: 'cycle-detected',
            message: `Cycle detected at ${targetKey}`,
            reference: targetRef,
            relationship: relationshipName,
          });
          continue;
        }

        queue.push({ reference: targetRef, depth: current.depth + 1 });
      }

      if (truncated) {
        break;
      }
    }

    if (truncated) {
      break;
    }
  }

  return Object.freeze({
    snapshotId: context.snapshotId,
    start: request.start,
    nodes: sortNodes([...nodeMap.values()]),
    edges: sortEdges(edges),
    truncated,
    warnings: Object.freeze(warnings),
  });
}
