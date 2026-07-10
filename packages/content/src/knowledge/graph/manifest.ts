import type { EntityReference, EntityType, KnowledgeEntity } from '../types.js';
import type { KnowledgeRelationshipDefinition } from './types.js';

export function parseRelationshipName(name: string): {
  sourceType: EntityType;
  relation: string;
} {
  const separator = name.indexOf('.');
  if (separator <= 0 || separator === name.length - 1) {
    throw new Error(`Invalid relationship name: ${name}`);
  }

  return {
    sourceType: name.slice(0, separator),
    relation: name.slice(separator + 1),
  };
}

export function buildRelationshipManifestIndex(
  manifest: readonly KnowledgeRelationshipDefinition[],
): ReadonlyMap<string, KnowledgeRelationshipDefinition> {
  const index = new Map<string, KnowledgeRelationshipDefinition>();
  for (const definition of manifest) {
    index.set(definition.name, definition);
  }
  return index;
}

export function extractRelationshipTargetIds(
  entity: KnowledgeEntity,
  definition: KnowledgeRelationshipDefinition,
): readonly string[] {
  const value = entity.fields[definition.field];
  const ids: string[] = [];

  if (typeof value === 'string' && value.trim().length > 0) {
    ids.push(value.trim());
  } else if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        ids.push(entry.trim());
      }
    }
  }

  return Object.freeze([...new Set(ids)].sort((a, b) => a.localeCompare(b)));
}

export function resolveRelationshipTargets(
  entity: KnowledgeEntity,
  definition: KnowledgeRelationshipDefinition,
): readonly EntityReference[] {
  if (entity.type !== definition.sourceType) {
    return Object.freeze([]);
  }

  return Object.freeze(
    extractRelationshipTargetIds(entity, definition).map((id) => ({
      type: definition.targetType,
      id,
    })),
  );
}

export function validateRelationshipManifest(
  manifest: readonly KnowledgeRelationshipDefinition[],
): void {
  const names = new Set<string>();
  for (const definition of manifest) {
    if (names.has(definition.name)) {
      throw new Error(`Duplicate relationship name: ${definition.name}`);
    }
    names.add(definition.name);

    const parsed = parseRelationshipName(definition.name);
    if (parsed.sourceType !== definition.sourceType || parsed.relation !== definition.relation) {
      throw new Error(`Relationship name mismatch for ${definition.name}`);
    }
  }
}

export function getRelationshipsForSourceType(
  manifest: readonly KnowledgeRelationshipDefinition[],
  sourceType: EntityType,
): readonly KnowledgeRelationshipDefinition[] {
  return Object.freeze(manifest.filter((definition) => definition.sourceType === sourceType));
}

export function relationKey(source: EntityReference, relation: string): string {
  return `${source.type}:${source.id}:${relation}`;
}
