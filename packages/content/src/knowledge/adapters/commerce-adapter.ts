import {
  type CommerceCollectionRecord,
  loadCommerceCollection,
} from '../../commerce/collection-loader.js';
import { resolveCommerceRepositoryPath } from '../../commerce/paths.js';
import type { CommerceKnowledgeLoaderOptions } from '../../commerce/types.js';
import type { ContextKnowledgeSourceAdapter } from '../context/index.js';
import { KnowledgeUnsupportedCollectionError } from '../errors.js';
import type {
  CommerceKnowledgeAccessors,
  CommerceKnowledgeAdapterOptions,
  EntityType,
  KnowledgeService,
  KnowledgeSourceEntity,
  KnowledgeSourceResult,
} from '../types.js';
import {
  getCommerceCollectionDefinition,
  getCommerceSupportedEntityTypes,
  getCommerceTier0EntityTypes,
  isCommerceSupportedEntityType,
} from './commerce/collection-registry.js';
import {
  getCommerceContextRecipes,
  getCommerceProjectionPolicy,
} from './commerce/context-recipes.js';
import {
  mapCommerceCollectionRecord,
  sortKnowledgeSourceEntities,
} from './commerce/entity-mapper.js';
import { getCommerceRelationshipManifest } from './commerce/relationship-manifest.js';

const COMMERCE_SOURCE_ID = 'piercingconnect-commerce';
const COMMERCE_SOURCE_TYPE = 'yaml-repository';

/** Read-only adapter for the PiercingConnect commerce YAML repository. */
export class CommerceKnowledgeSourceAdapter implements ContextKnowledgeSourceAdapter {
  readonly sourceId = COMMERCE_SOURCE_ID;
  readonly sourceType = COMMERCE_SOURCE_TYPE;

  private repoPath?: string;
  private readonly loadedTypes = new Set<EntityType>();
  private entities: KnowledgeSourceEntity[] = [];
  private warnings: string[] = [];

  constructor(private readonly options?: CommerceKnowledgeAdapterOptions) {}

  getSupportedEntityTypes(): readonly EntityType[] {
    return getCommerceSupportedEntityTypes();
  }

  getLoadedEntityTypes(): readonly EntityType[] {
    return Object.freeze([...this.loadedTypes].sort((a, b) => a.localeCompare(b)));
  }

  isSupportedEntityType(entityType: EntityType): boolean {
    return isCommerceSupportedEntityType(entityType);
  }

  getRelationshipManifest() {
    return getCommerceRelationshipManifest();
  }

  getContextRecipes() {
    return getCommerceContextRecipes();
  }

  getProjectionPolicy() {
    return getCommerceProjectionPolicy();
  }

  async load(): Promise<KnowledgeSourceResult> {
    return this.ensureEntityTypes(getCommerceTier0EntityTypes());
  }

  async ensureEntityTypes(types: readonly EntityType[]): Promise<KnowledgeSourceResult> {
    const repoPath = await this.resolveRepoPath();
    const loaderOptions = this.toLoaderOptions();

    for (const entityType of types) {
      const definition = getCommerceCollectionDefinition(entityType);
      if (!definition) {
        throw new KnowledgeUnsupportedCollectionError(entityType);
      }

      if (this.loadedTypes.has(entityType)) {
        continue;
      }

      const records = await loadCommerceCollection(
        repoPath,
        definition.dataSegments,
        definition.entityLabel,
        {
          ...loaderOptions,
          displayNameFields: definition.displayNameFields,
        },
      );

      const mapped = records.map((record: CommerceCollectionRecord) =>
        mapCommerceCollectionRecord(definition, record),
      );
      this.entities.push(...mapped);
      this.loadedTypes.add(entityType);
    }

    return this.buildResult(repoPath);
  }

  async loadAllCollections(): Promise<KnowledgeSourceResult> {
    return this.ensureEntityTypes(getCommerceSupportedEntityTypes());
  }

  private async resolveRepoPath(): Promise<string> {
    if (this.repoPath === undefined) {
      this.repoPath = await resolveCommerceRepositoryPath(this.toLoaderOptions());
    }
    return this.repoPath;
  }

  private toLoaderOptions(): CommerceKnowledgeLoaderOptions {
    return {
      repoPath: this.options?.repoPath,
      mediaEngineRoot: this.options?.mediaEngineRoot,
      maxYamlFileBytes: this.options?.maxYamlFileBytes,
      maxAliasCount: this.options?.maxAliasCount,
    };
  }

  private buildResult(repoPath: string): KnowledgeSourceResult {
    return {
      sourcePath: repoPath,
      entities: Object.freeze(sortKnowledgeSourceEntities(this.entities)),
      warnings: Object.freeze([...this.warnings]),
      loadedCollectionCount: this.loadedTypes.size,
      supportedCollectionCount: getCommerceSupportedEntityTypes().length,
    };
  }
}

/** Commerce-specific lookup helpers built on the generic knowledge service API. */
export function createCommerceKnowledgeAccessors(
  service: KnowledgeService,
): CommerceKnowledgeAccessors {
  return {
    getBrand: (id: string) => service.getEntity('brand', id),
    getProduct: (id: string) => service.getEntity('product', id),
    getProductsByBrand: (brandId: string) =>
      service.getRelatedEntities({ type: 'brand', id: brandId }, 'products'),
  };
}

export {
  COMMERCE_COLLECTION_REGISTRY,
  getCommerceCollectionDefinition,
  getCommerceSupportedEntityTypes,
  getCommerceTier0EntityTypes,
  isCommerceSupportedEntityType,
} from './commerce/collection-registry.js';
export {
  COMMERCE_CONTEXT_RECIPES,
  getCommerceContextRecipe,
  getCommerceContextRecipes,
  getCommerceProjectionPolicy,
} from './commerce/context-recipes.js';
export {
  COMMERCE_RELATIONSHIP_MANIFEST,
  getCommerceRelationshipDefinition,
  getCommerceRelationshipManifest,
} from './commerce/relationship-manifest.js';
