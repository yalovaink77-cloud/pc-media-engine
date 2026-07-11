import type { KnowledgeRelationshipDefinition } from '../../graph/types.js';

function defineRelationship(
  sourceType: string,
  relation: string,
  targetType: string,
  field: string,
): KnowledgeRelationshipDefinition {
  return {
    name: `${sourceType}.${relation}`,
    sourceType,
    relation,
    targetType,
    field,
  };
}

/** PiercingConnect commerce repository relationship manifest. */
export const COMMERCE_RELATIONSHIP_MANIFEST: readonly KnowledgeRelationshipDefinition[] = [
  defineRelationship('brand', 'products', 'product', 'products'),
  defineRelationship('product', 'brand', 'brand', 'brand'),
  defineRelationship('product', 'ingredients', 'ingredient', 'ingredients'),
  defineRelationship('product', 'product-category', 'product-category', 'category'),
  defineRelationship('product', 'healing-stages', 'healing-stage', 'healing_stages'),
  defineRelationship('problem', 'symptoms', 'symptom', 'symptoms'),
  defineRelationship('problem', 'related-products', 'product', 'related_products'),
  defineRelationship('problem', 'related-ingredients', 'ingredient', 'related_ingredients'),
  defineRelationship('piercing-type', 'common-problems', 'problem', 'common_problems'),
  defineRelationship('piercing-type', 'healing-stages', 'healing-stage', 'healing_stages'),
  defineRelationship('keyword-cluster', 'related-products', 'product', 'related_products'),
  defineRelationship('keyword-cluster', 'related-brands', 'brand', 'related_brands'),
  defineRelationship('keyword-cluster', 'related-problems', 'problem', 'related_problems'),
  defineRelationship(
    'keyword-cluster',
    'related-piercing-types',
    'piercing-type',
    'related_piercing_types',
  ),
] as const;

const manifestByName = new Map(
  COMMERCE_RELATIONSHIP_MANIFEST.map((definition) => [definition.name, definition]),
);

export function getCommerceRelationshipManifest(): readonly KnowledgeRelationshipDefinition[] {
  return COMMERCE_RELATIONSHIP_MANIFEST;
}

export function getCommerceRelationshipDefinition(
  name: string,
): KnowledgeRelationshipDefinition | undefined {
  return manifestByName.get(name);
}
