/** Supported entity types for the current knowledge source increment. */
export type EntityType = 'brand' | 'product' | (string & {});

/** Stable reference to a knowledge entity. */
export interface EntityReference {
  type: EntityType;
  id: string;
}

/** Generic knowledge entity loaded from an external source. */
export interface KnowledgeEntity {
  readonly type: EntityType;
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /** Source-specific fields excluding core identity keys. */
  readonly fields: Readonly<Record<string, unknown>>;
}

/** Metadata describing a loaded immutable snapshot. */
export interface KnowledgeSnapshotMetadata {
  readonly snapshotId: string;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourcePath: string;
  readonly createdAt: string;
  readonly entityCounts: Readonly<Partial<Record<EntityType, number>>>;
  readonly warnings: readonly string[];
}

/** Immutable in-memory view of loaded knowledge entities. */
export interface KnowledgeSnapshot extends KnowledgeSnapshotMetadata {
  readonly totalEntityCount: number;
  readonly loadedCollectionCount: number;
  readonly supportedCollectionCount: number;
}

/** Flat entity record produced by a knowledge source adapter. */
export interface KnowledgeSourceEntity {
  type: EntityType;
  id: string;
  slug: string;
  name: string;
  fields: Record<string, unknown>;
  relations?: readonly KnowledgeSourceRelation[];
}

/** Directed relation declared by a source entity. */
export interface KnowledgeSourceRelation {
  name: string;
  targetType: EntityType;
  targetId: string;
}

/** Result returned by a knowledge source adapter load operation. */
export interface KnowledgeSourceResult {
  sourcePath: string;
  entities: readonly KnowledgeSourceEntity[];
  warnings?: readonly string[];
  loadedCollectionCount?: number;
  supportedCollectionCount?: number;
}

/** Contract for read-only external knowledge sources. */
export interface KnowledgeSourceAdapter {
  readonly sourceId: string;
  readonly sourceType: string;
  load(): Promise<KnowledgeSourceResult>;
}

/** Optional incremental loading contract for source adapters with lazy collections. */
export interface IncrementalKnowledgeSourceAdapter extends KnowledgeSourceAdapter {
  getSupportedEntityTypes(): readonly EntityType[];
  getLoadedEntityTypes(): readonly EntityType[];
  isSupportedEntityType(entityType: EntityType): boolean;
  ensureEntityTypes(types: readonly EntityType[]): Promise<KnowledgeSourceResult>;
}

/** Options for creating a knowledge service instance. */
export interface KnowledgeServiceOptions {
  /** When true, single-entity lookups throw when an entity is missing. */
  strict?: boolean;
  /** Source adapter. Defaults to the commerce repository adapter. */
  adapter?: KnowledgeSourceAdapter;
  /** Options forwarded to the default commerce adapter when no adapter is supplied. */
  commerce?: CommerceKnowledgeAdapterOptions;
}

/** Commerce adapter configuration (PiercingConnect-first source). */
export interface CommerceKnowledgeAdapterOptions {
  repoPath?: string;
  mediaEngineRoot?: string;
  maxYamlFileBytes?: number;
  maxAliasCount?: number;
}

/** Generic lookup and indexing API for knowledge entities. */
export interface KnowledgeService {
  getSnapshot(): Promise<KnowledgeSnapshot>;
  getEntity(type: EntityType, id: string): Promise<KnowledgeEntity | undefined>;
  getEntityBySlug(type: EntityType, slug: string): Promise<KnowledgeEntity | undefined>;
  getEntitiesByType(type: EntityType): Promise<readonly KnowledgeEntity[]>;
  getRelatedEntities(
    reference: EntityReference,
    relation: string,
  ): Promise<readonly KnowledgeEntity[]>;
}

/** Commerce-specific lookup helpers (adapter layer, not generic service API). */
export interface CommerceKnowledgeAccessors {
  getBrand(id: string): Promise<KnowledgeEntity | undefined>;
  getProduct(id: string): Promise<KnowledgeEntity | undefined>;
  getProductsByBrand(brandId: string): Promise<readonly KnowledgeEntity[]>;
}
