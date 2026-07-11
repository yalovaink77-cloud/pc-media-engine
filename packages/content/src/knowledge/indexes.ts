import { KnowledgeSnapshotError } from './errors.js';
import { resolveRelationshipTargets } from './graph/manifest.js';
import type { KnowledgeRelationshipDefinition } from './graph/types.js';
import type {
  EntityReference,
  EntityType,
  KnowledgeEntity,
  KnowledgeSourceEntity,
} from './types.js';

export interface KnowledgeIndexes {
  readonly byId: ReadonlyMap<string, KnowledgeEntity>;
  readonly slugToId: ReadonlyMap<string, string>;
  readonly byType: ReadonlyMap<EntityType, readonly KnowledgeEntity[]>;
  readonly relatedBySource: ReadonlyMap<string, readonly EntityReference[]>;
}

function entityKey(type: EntityType, id: string): string {
  return `${type}:${id}`;
}

export function relationKey(source: EntityReference, relation: string): string {
  return `${source.type}:${source.id}:${relation}`;
}

function sortEntities(entities: KnowledgeEntity[]): readonly KnowledgeEntity[] {
  return Object.freeze([...entities].sort((a, b) => a.id.localeCompare(b.id)));
}

function sortReferences(references: readonly EntityReference[]): readonly EntityReference[] {
  return Object.freeze([...references].sort((a, b) => a.id.localeCompare(b.id)));
}

function toKnowledgeEntity(sourceEntity: KnowledgeSourceEntity): KnowledgeEntity {
  return Object.freeze({
    type: sourceEntity.type,
    id: sourceEntity.id,
    slug: sourceEntity.slug,
    name: sourceEntity.name,
    fields: Object.freeze({ ...sourceEntity.fields }),
  });
}

function appendRelation(
  map: Map<string, EntityReference[]>,
  source: EntityReference,
  relation: string,
  target: EntityReference,
): void {
  const key = relationKey(source, relation);
  const existing = map.get(key) ?? [];
  if (!existing.some((entry) => entry.type === target.type && entry.id === target.id)) {
    existing.push(target);
  }
  map.set(key, existing);
}

function appendLegacyRelations(
  map: Map<string, EntityReference[]>,
  sourceEntity: KnowledgeSourceEntity,
): void {
  const sourceRef: EntityReference = { type: sourceEntity.type, id: sourceEntity.id };
  for (const relation of sourceEntity.relations ?? []) {
    appendRelation(map, sourceRef, relation.name, {
      type: relation.targetType,
      id: relation.targetId,
    });
  }
}

function appendManifestRelations(
  map: Map<string, EntityReference[]>,
  entity: KnowledgeEntity,
  manifest: readonly KnowledgeRelationshipDefinition[],
): void {
  const sourceRef: EntityReference = { type: entity.type, id: entity.id };
  for (const definition of manifest) {
    if (definition.sourceType !== entity.type) {
      continue;
    }

    for (const target of resolveRelationshipTargets(entity, definition)) {
      appendRelation(map, sourceRef, definition.relation, target);
    }
  }
}

function findInverseRelationshipDefinition(
  definition: KnowledgeRelationshipDefinition,
  manifest: readonly KnowledgeRelationshipDefinition[],
): KnowledgeRelationshipDefinition | undefined {
  return manifest.find(
    (candidate) =>
      candidate.sourceType === definition.targetType &&
      candidate.targetType === definition.sourceType,
  );
}

function isForeignKeyRelationship(definition: KnowledgeRelationshipDefinition): boolean {
  const normalizedTarget = definition.targetType.replace(/-/g, '_');
  return definition.field === definition.targetType || definition.field === normalizedTarget;
}

/** Populate forward relations from inverse foreign-key fields declared in the manifest. */
function appendInverseManifestRelations(
  map: Map<string, EntityReference[]>,
  entities: Iterable<KnowledgeEntity>,
  manifest: readonly KnowledgeRelationshipDefinition[],
): void {
  const processedPairs = new Set<string>();

  for (const inverseDefinition of manifest) {
    if (!isForeignKeyRelationship(inverseDefinition)) {
      continue;
    }

    const forwardDefinition = findInverseRelationshipDefinition(inverseDefinition, manifest);
    if (!forwardDefinition) {
      continue;
    }

    const pairKey = [forwardDefinition.name, inverseDefinition.name].sort().join('|');
    if (processedPairs.has(pairKey)) {
      continue;
    }
    processedPairs.add(pairKey);

    for (const entity of entities) {
      if (entity.type !== inverseDefinition.sourceType) {
        continue;
      }

      for (const target of resolveRelationshipTargets(entity, inverseDefinition)) {
        appendRelation(map, target, forwardDefinition.relation, {
          type: entity.type,
          id: entity.id,
        });
      }
    }
  }
}

function buildLegacyInverseRelations(
  entities: readonly KnowledgeSourceEntity[],
): Map<string, EntityReference[]> {
  const inverse = new Map<string, EntityReference[]>();

  for (const entity of entities) {
    if (entity.type !== 'product') {
      continue;
    }

    const brandId = entity.fields.brand;
    if (typeof brandId !== 'string' || brandId.trim().length === 0) {
      continue;
    }

    const key = relationKey({ type: 'brand', id: brandId }, 'products');
    const existing = inverse.get(key) ?? [];
    existing.push({ type: 'product', id: entity.id });
    inverse.set(key, existing);
  }

  return inverse;
}

export function buildKnowledgeIndexes(
  sourceEntities: readonly KnowledgeSourceEntity[],
  manifest: readonly KnowledgeRelationshipDefinition[] = [],
): KnowledgeIndexes {
  const byId = new Map<string, KnowledgeEntity>();
  const slugToId = new Map<string, string>();
  const byType = new Map<EntityType, KnowledgeEntity[]>();
  const relatedBySource = new Map<string, EntityReference[]>();

  for (const sourceEntity of sourceEntities) {
    const key = entityKey(sourceEntity.type, sourceEntity.id);
    if (byId.has(key)) {
      throw new KnowledgeSnapshotError(
        `Duplicate entity id for type ${sourceEntity.type}: ${sourceEntity.id}`,
      );
    }

    const entity = toKnowledgeEntity(sourceEntity);
    byId.set(key, entity);

    const slugKey = entityKey(sourceEntity.type, sourceEntity.slug);
    if (slugToId.has(slugKey)) {
      throw new KnowledgeSnapshotError(
        `Duplicate entity slug for type ${sourceEntity.type}: ${sourceEntity.slug}`,
      );
    }
    slugToId.set(slugKey, sourceEntity.id);

    const typeEntities = byType.get(sourceEntity.type) ?? [];
    typeEntities.push(entity);
    byType.set(sourceEntity.type, typeEntities);
  }

  if (manifest.length > 0) {
    for (const entity of byId.values()) {
      appendManifestRelations(relatedBySource, entity, manifest);
    }
    appendInverseManifestRelations(relatedBySource, byId.values(), manifest);
  } else {
    for (const sourceEntity of sourceEntities) {
      appendLegacyRelations(relatedBySource, sourceEntity);
    }

    for (const [key, refs] of buildLegacyInverseRelations(sourceEntities).entries()) {
      relatedBySource.set(key, refs);
    }
  }

  for (const [key, refs] of relatedBySource.entries()) {
    relatedBySource.set(key, [...sortReferences(refs)]);
  }

  const frozenByType = new Map<EntityType, readonly KnowledgeEntity[]>();
  for (const [type, entities] of byType.entries()) {
    frozenByType.set(type, sortEntities(entities));
  }

  return Object.freeze({
    byId: byId as ReadonlyMap<string, KnowledgeEntity>,
    slugToId: slugToId as ReadonlyMap<string, string>,
    byType: frozenByType as ReadonlyMap<EntityType, readonly KnowledgeEntity[]>,
    relatedBySource: relatedBySource as ReadonlyMap<string, readonly EntityReference[]>,
  });
}

export function lookupEntity(
  indexes: KnowledgeIndexes,
  type: EntityType,
  id: string,
): KnowledgeEntity | undefined {
  return indexes.byId.get(entityKey(type, id));
}

export function lookupEntityBySlug(
  indexes: KnowledgeIndexes,
  type: EntityType,
  slug: string,
): KnowledgeEntity | undefined {
  const id = indexes.slugToId.get(entityKey(type, slug));
  if (!id) {
    return undefined;
  }
  return lookupEntity(indexes, type, id);
}

export function lookupRelationshipTargets(
  indexes: KnowledgeIndexes,
  reference: EntityReference,
  relation: string,
): readonly EntityReference[] {
  return indexes.relatedBySource.get(relationKey(reference, relation)) ?? Object.freeze([]);
}

export function lookupRelatedEntities(
  indexes: KnowledgeIndexes,
  reference: EntityReference,
  relation: string,
): readonly KnowledgeEntity[] {
  const refs = lookupRelationshipTargets(indexes, reference, relation);
  const entities: KnowledgeEntity[] = [];

  for (const ref of refs) {
    const entity = lookupEntity(indexes, ref.type, ref.id);
    if (entity) {
      entities.push(entity);
    }
  }

  return sortEntities(entities);
}
