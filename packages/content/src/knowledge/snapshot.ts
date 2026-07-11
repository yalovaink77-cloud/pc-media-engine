import { randomUUID } from 'node:crypto';

import type { GraphKnowledgeSourceAdapter } from './graph/types.js';
import { buildKnowledgeIndexes, type KnowledgeIndexes } from './indexes.js';
import type {
  EntityType,
  KnowledgeSnapshot,
  KnowledgeSourceAdapter,
  KnowledgeSourceResult,
} from './types.js';

interface SnapshotState extends KnowledgeSnapshot {
  readonly indexes: KnowledgeIndexes;
}

function countEntitiesByType(
  indexes: KnowledgeIndexes,
): Readonly<Partial<Record<EntityType, number>>> {
  const counts: Partial<Record<EntityType, number>> = {};
  for (const [type, entities] of indexes.byType.entries()) {
    counts[type] = entities.length;
  }
  return Object.freeze(counts);
}

export async function buildKnowledgeSnapshot(
  adapter: KnowledgeSourceAdapter,
  loaded?: KnowledgeSourceResult,
): Promise<SnapshotState> {
  const sourceResult = loaded ?? (await adapter.load());
  const manifest =
    'getRelationshipManifest' in adapter && typeof adapter.getRelationshipManifest === 'function'
      ? (adapter as GraphKnowledgeSourceAdapter).getRelationshipManifest()
      : [];
  const indexes = buildKnowledgeIndexes(sourceResult.entities, manifest);
  const entityCounts = countEntitiesByType(indexes);
  const totalEntityCount = sourceResult.entities.length;

  const snapshot: SnapshotState = Object.freeze({
    snapshotId: randomUUID(),
    sourceId: adapter.sourceId,
    sourceType: adapter.sourceType,
    sourcePath: sourceResult.sourcePath,
    createdAt: new Date().toISOString(),
    entityCounts,
    warnings: Object.freeze([...(sourceResult.warnings ?? [])]),
    totalEntityCount,
    loadedCollectionCount: sourceResult.loadedCollectionCount ?? Object.keys(entityCounts).length,
    supportedCollectionCount:
      sourceResult.supportedCollectionCount ?? Object.keys(entityCounts).length,
    indexes,
  });

  return snapshot;
}
