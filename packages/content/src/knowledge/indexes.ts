import { KnowledgeSnapshotError } from './errors.js';
import type {
  EntityReference,
  EntityType,
  KnowledgeEntity,
  KnowledgeSourceEntity,
  KnowledgeSourceRelation,
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

function relationKey(source: EntityReference, relation: string): string {
  return `${source.type}:${source.id}:${relation}`;
}

function sortEntities(entities: KnowledgeEntity[]): readonly KnowledgeEntity[] {
  return Object.freeze([...entities].sort((a, b) => a.id.localeCompare(b.id)));
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
  relation: KnowledgeSourceRelation,
): void {
  const key = relationKey(source, relation.name);
  const existing = map.get(key) ?? [];
  existing.push({ type: relation.targetType, id: relation.targetId });
  map.set(key, existing);
}

function buildInverseRelations(
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

  for (const [key, refs] of inverse.entries()) {
    refs.sort((a, b) => a.id.localeCompare(b.id));
    inverse.set(key, refs);
  }

  return inverse;
}

export function buildKnowledgeIndexes(
  sourceEntities: readonly KnowledgeSourceEntity[],
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

    const sourceRef: EntityReference = { type: sourceEntity.type, id: sourceEntity.id };
    for (const relation of sourceEntity.relations ?? []) {
      appendRelation(relatedBySource, sourceRef, relation);
    }
  }

  const inverseRelations = buildInverseRelations(sourceEntities);
  for (const [key, refs] of inverseRelations.entries()) {
    relatedBySource.set(key, refs);
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

export function lookupRelatedEntities(
  indexes: KnowledgeIndexes,
  reference: EntityReference,
  relation: string,
): readonly KnowledgeEntity[] {
  const refs = indexes.relatedBySource.get(relationKey(reference, relation)) ?? [];
  const entities: KnowledgeEntity[] = [];

  for (const ref of refs) {
    const entity = lookupEntity(indexes, ref.type, ref.id);
    if (entity) {
      entities.push(entity);
    }
  }

  return sortEntities(entities);
}
