import type { EntityType } from '../../types.js';

/** Collection loading priority — tier 0 loads eagerly, tier 1 loads on demand. */
export type CollectionLoadTier = 0 | 1;

/** Commerce repository collection definition used by the source adapter. */
export interface CommerceCollectionDefinition {
  readonly entityType: EntityType;
  readonly dataSegments: readonly string[];
  readonly entityLabel: string;
  readonly loadTier: CollectionLoadTier;
  readonly displayNameFields?: readonly string[];
  readonly projectionMetadata?: Readonly<Record<string, unknown>>;
}

export const COMMERCE_COLLECTION_REGISTRY: readonly CommerceCollectionDefinition[] = [
  {
    entityType: 'brand',
    dataSegments: ['brands'],
    entityLabel: 'brand',
    loadTier: 0,
    projectionMetadata: { domain: 'commerce' },
  },
  {
    entityType: 'product',
    dataSegments: ['products'],
    entityLabel: 'product',
    loadTier: 0,
    projectionMetadata: { domain: 'commerce' },
  },
  {
    entityType: 'ingredient',
    dataSegments: ['ingredients'],
    entityLabel: 'ingredient',
    loadTier: 1,
    projectionMetadata: { domain: 'aftercare' },
  },
  {
    entityType: 'problem',
    dataSegments: ['problems'],
    entityLabel: 'problem',
    loadTier: 1,
    projectionMetadata: { domain: 'aftercare' },
  },
  {
    entityType: 'healing-stage',
    dataSegments: ['healing-stages'],
    entityLabel: 'healing-stage',
    loadTier: 1,
    projectionMetadata: { domain: 'aftercare' },
  },
  {
    entityType: 'piercing-type',
    dataSegments: ['piercing-types'],
    entityLabel: 'piercing-type',
    loadTier: 1,
    projectionMetadata: { domain: 'aftercare' },
  },
  {
    entityType: 'body-location',
    dataSegments: ['body-locations'],
    entityLabel: 'body-location',
    loadTier: 1,
    projectionMetadata: { domain: 'aftercare' },
  },
  {
    entityType: 'material',
    dataSegments: ['materials'],
    entityLabel: 'material',
    loadTier: 1,
    projectionMetadata: { domain: 'jewelry' },
  },
  {
    entityType: 'jewelry-type',
    dataSegments: ['jewelry-types'],
    entityLabel: 'jewelry-type',
    loadTier: 1,
    projectionMetadata: { domain: 'jewelry' },
  },
  {
    entityType: 'product-category',
    dataSegments: ['product-categories'],
    entityLabel: 'product-category',
    loadTier: 1,
    projectionMetadata: { domain: 'commerce' },
  },
  {
    entityType: 'keyword-cluster',
    dataSegments: ['keywords'],
    entityLabel: 'keyword-cluster',
    loadTier: 1,
    displayNameFields: ['primary_keyword'],
    projectionMetadata: { domain: 'seo' },
  },
  {
    entityType: 'risk-level',
    dataSegments: ['risk-levels'],
    entityLabel: 'risk-level',
    loadTier: 1,
    projectionMetadata: { domain: 'safety' },
  },
  {
    entityType: 'search-intent',
    dataSegments: ['search-intents'],
    entityLabel: 'search-intent',
    loadTier: 1,
    projectionMetadata: { domain: 'seo' },
  },
  {
    entityType: 'symptom',
    dataSegments: ['symptoms'],
    entityLabel: 'symptom',
    loadTier: 1,
    projectionMetadata: { domain: 'aftercare' },
  },
  {
    entityType: 'affiliate-program',
    dataSegments: ['affiliate-programs'],
    entityLabel: 'affiliate-program',
    loadTier: 1,
    projectionMetadata: { domain: 'affiliate' },
  },
  {
    entityType: 'content-asset',
    dataSegments: ['content-assets'],
    entityLabel: 'content-asset',
    loadTier: 1,
    projectionMetadata: { domain: 'publishing' },
  },
  {
    entityType: 'template',
    dataSegments: ['templates'],
    entityLabel: 'template',
    loadTier: 1,
    projectionMetadata: { domain: 'publishing' },
  },
  {
    entityType: 'country',
    dataSegments: ['countries'],
    entityLabel: 'country',
    loadTier: 1,
    projectionMetadata: { domain: 'commerce' },
  },
] as const;

const registryByType = new Map<EntityType, CommerceCollectionDefinition>(
  COMMERCE_COLLECTION_REGISTRY.map((definition) => [definition.entityType, definition]),
);

export function getCommerceCollectionDefinition(
  entityType: EntityType,
): CommerceCollectionDefinition | undefined {
  return registryByType.get(entityType);
}

export function getCommerceSupportedEntityTypes(): readonly EntityType[] {
  return COMMERCE_COLLECTION_REGISTRY.map((definition) => definition.entityType);
}

export function getCommerceTier0EntityTypes(): readonly EntityType[] {
  return COMMERCE_COLLECTION_REGISTRY.filter((definition) => definition.loadTier === 0).map(
    (definition) => definition.entityType,
  );
}

export function isCommerceSupportedEntityType(entityType: EntityType): boolean {
  return registryByType.has(entityType);
}
