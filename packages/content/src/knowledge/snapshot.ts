import { randomUUID } from 'node:crypto';

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
  const indexes = buildKnowledgeIndexes(sourceResult.entities);
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
    indexes,
  });

  return snapshot;
}
