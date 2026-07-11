import type { CommerceCollectionRecord } from '../../../commerce/collection-loader.js';
import type { EntityType, KnowledgeSourceEntity, KnowledgeSourceRelation } from '../../types.js';
import type { CommerceCollectionDefinition } from './collection-registry.js';

function omitIdentityFields(raw: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'id' || key === 'slug' || key === 'name') {
      continue;
    }
    fields[key] = value;
  }
  return fields;
}

function extractRelations(
  entityType: EntityType,
  raw: Record<string, unknown>,
): KnowledgeSourceRelation[] {
  const relations: KnowledgeSourceRelation[] = [];

  if (entityType === 'brand') {
    const products = raw.products;
    if (Array.isArray(products)) {
      for (const productId of products) {
        if (typeof productId === 'string' && productId.trim().length > 0) {
          relations.push({ name: 'products', targetType: 'product', targetId: productId });
        }
      }
    }
    return relations;
  }

  if (entityType === 'product') {
    const brandId = raw.brand;
    if (typeof brandId === 'string' && brandId.trim().length > 0) {
      relations.push({ name: 'brand', targetType: 'brand', targetId: brandId });
    }
  }

  return relations;
}

export function mapCommerceCollectionRecord(
  definition: CommerceCollectionDefinition,
  record: CommerceCollectionRecord,
): KnowledgeSourceEntity {
  return {
    type: definition.entityType,
    id: record.id,
    slug: record.slug,
    name: record.name,
    fields: omitIdentityFields(record.raw),
    relations: extractRelations(definition.entityType, record.raw),
  };
}

export function sortKnowledgeSourceEntities(
  entities: readonly KnowledgeSourceEntity[],
): KnowledgeSourceEntity[] {
  return [...entities].sort((a, b) => {
    const typeOrder = a.type.localeCompare(b.type);
    if (typeOrder !== 0) {
      return typeOrder;
    }
    return a.id.localeCompare(b.id);
  });
}
