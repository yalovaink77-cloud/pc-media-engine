import { CommerceKnowledgeSourceAdapter } from './adapters/commerce-adapter.js';
import { buildKnowledgeContext } from './context/build.js';
import { getContextRecipe, isContextKnowledgeSourceAdapter } from './context/index.js';
import type { KnowledgeContextRequest, KnowledgeContextResult } from './context/types.js';
import {
  KnowledgeContextMissingRequiredError,
  KnowledgeContextRootTypeError,
  KnowledgeEntityNotFoundError,
  KnowledgeServiceError,
  KnowledgeUnsupportedCollectionError,
  KnowledgeUnsupportedContextRecipeError,
} from './errors.js';
import { buildRelationshipManifestIndex } from './graph/manifest.js';
import { traverseKnowledgeGraph } from './graph/traverse.js';
import type {
  GraphKnowledgeSourceAdapter,
  KnowledgeTraversalRequest,
  KnowledgeTraversalResult,
} from './graph/types.js';
import {
  type KnowledgeIndexes,
  lookupEntity,
  lookupEntityBySlug,
  lookupRelatedEntities,
} from './indexes.js';
import { buildKnowledgeSnapshot } from './snapshot.js';
import type {
  EntityReference,
  EntityType,
  IncrementalKnowledgeSourceAdapter,
  KnowledgeEntity,
  KnowledgeService,
  KnowledgeServiceOptions,
  KnowledgeSnapshot,
  KnowledgeSourceAdapter,
  KnowledgeSourceResult,
} from './types.js';

interface SnapshotState extends KnowledgeSnapshot {
  readonly indexes: KnowledgeIndexes;
}

function isGraphAdapter(adapter: KnowledgeSourceAdapter): adapter is GraphKnowledgeSourceAdapter {
  return (
    'getRelationshipManifest' in adapter && typeof adapter.getRelationshipManifest === 'function'
  );
}

function isIncrementalAdapter(
  adapter: KnowledgeSourceAdapter,
): adapter is IncrementalKnowledgeSourceAdapter {
  return (
    'ensureEntityTypes' in adapter &&
    typeof adapter.ensureEntityTypes === 'function' &&
    'isSupportedEntityType' in adapter
  );
}

export class KnowledgeServiceImpl implements KnowledgeService {
  private snapshotPromise: Promise<SnapshotState> | undefined;
  private readonly strict: boolean;
  private readonly adapter: KnowledgeSourceAdapter;

  constructor(options?: KnowledgeServiceOptions) {
    this.strict = options?.strict ?? false;
    this.adapter = options?.adapter ?? new CommerceKnowledgeSourceAdapter(options?.commerce);
  }

  async getSnapshot(): Promise<KnowledgeSnapshot> {
    const snapshot = await this.loadSnapshot();
    return this.toPublicSnapshot(snapshot);
  }

  async getEntity(type: EntityType, id: string): Promise<KnowledgeEntity | undefined> {
    this.assertSupportedEntityType(type);
    const snapshot = await this.ensureEntityTypeAvailable(type);
    const entity = lookupEntity(snapshot.indexes, type, id);
    if (!entity && this.strict) {
      throw new KnowledgeEntityNotFoundError({ type, id });
    }
    return entity;
  }

  async getEntityBySlug(type: EntityType, slug: string): Promise<KnowledgeEntity | undefined> {
    this.assertSupportedEntityType(type);
    const snapshot = await this.ensureEntityTypeAvailable(type);
    const entity = lookupEntityBySlug(snapshot.indexes, type, slug);
    if (!entity && this.strict) {
      throw new KnowledgeEntityNotFoundError({ type, id: slug });
    }
    return entity;
  }

  async getEntitiesByType(type: EntityType): Promise<readonly KnowledgeEntity[]> {
    this.assertSupportedEntityType(type);
    const snapshot = await this.ensureEntityTypeAvailable(type);
    return snapshot.indexes.byType.get(type) ?? Object.freeze([]);
  }

  async getRelatedEntities(
    reference: EntityReference,
    relation: string,
  ): Promise<readonly KnowledgeEntity[]> {
    this.assertSupportedEntityType(reference.type);
    const snapshot = await this.ensureEntityTypeAvailable(reference.type);
    if (this.strict && !lookupEntity(snapshot.indexes, reference.type, reference.id)) {
      throw new KnowledgeEntityNotFoundError(reference);
    }
    return lookupRelatedEntities(snapshot.indexes, reference, relation);
  }

  async traverse(request: KnowledgeTraversalRequest): Promise<KnowledgeTraversalResult> {
    if (!isGraphAdapter(this.adapter)) {
      throw new KnowledgeServiceError('Adapter does not support graph traversal');
    }

    const manifest = this.adapter.getRelationshipManifest();
    const manifestIndex = buildRelationshipManifestIndex(manifest);
    const strict = request.strict ?? this.strict;

    let snapshot = await this.loadSnapshot();

    return traverseKnowledgeGraph(
      {
        snapshotId: snapshot.snapshotId,
        getIndexes: () => snapshot.indexes,
        lookupEntity: (type, id) => lookupEntity(snapshot.indexes, type, id),
        ensureEntityType: async (type) => {
          snapshot = await this.ensureEntityTypeAvailable(type);
        },
      },
      manifestIndex,
      request,
      strict,
    );
  }

  async buildContext(request: KnowledgeContextRequest): Promise<KnowledgeContextResult> {
    if (!isContextKnowledgeSourceAdapter(this.adapter)) {
      throw new KnowledgeServiceError('Adapter does not support context building');
    }

    const recipe = getContextRecipe(this.adapter.getContextRecipes(), request.recipe);
    if (!recipe) {
      throw new KnowledgeUnsupportedContextRecipeError(request.recipe);
    }

    if (request.root.type !== recipe.rootEntityType) {
      throw new KnowledgeContextRootTypeError({
        recipeId: recipe.id,
        expectedType: recipe.rootEntityType,
        actualType: request.root.type,
      });
    }

    const projection = request.projection ?? recipe.defaultProjection;
    const strict = request.strict ?? this.strict;

    const snapshot = await this.toPublicSnapshot(
      await this.ensureEntityTypeAvailable(request.root.type),
    );
    const traversal = await this.traverse({
      start: request.root,
      follow: recipe.follow,
      maxDepth: recipe.maxDepth,
      maxNodes: recipe.maxNodes,
      strict,
    });

    const context = buildKnowledgeContext({
      recipe,
      request,
      projection,
      traversal,
      snapshot,
      policy: this.adapter.getProjectionPolicy?.(),
    });

    if (strict && context.missingRequired.length > 0) {
      throw new KnowledgeContextMissingRequiredError({
        recipeId: recipe.id,
        missingRequired: context.missingRequired,
      });
    }

    return context;
  }

  private assertSupportedEntityType(type: EntityType): void {
    if (isIncrementalAdapter(this.adapter) && !this.adapter.isSupportedEntityType(type)) {
      throw new KnowledgeUnsupportedCollectionError(type);
    }
  }

  private async ensureEntityTypeAvailable(type: EntityType): Promise<SnapshotState> {
    const snapshot = await this.loadSnapshot();

    if (!isIncrementalAdapter(this.adapter)) {
      return snapshot;
    }

    if (this.adapter.getLoadedEntityTypes().includes(type)) {
      return snapshot;
    }

    const result = await this.adapter.ensureEntityTypes([type]);
    return this.refreshSnapshot(result);
  }

  private async refreshSnapshot(result: KnowledgeSourceResult): Promise<SnapshotState> {
    const snapshot = await buildKnowledgeSnapshot(this.adapter, result);
    this.snapshotPromise = Promise.resolve(snapshot);
    return snapshot;
  }

  private async loadSnapshot(): Promise<SnapshotState> {
    if (!this.snapshotPromise) {
      this.snapshotPromise = buildKnowledgeSnapshot(this.adapter);
    }
    return this.snapshotPromise;
  }

  private toPublicSnapshot(snapshot: SnapshotState): KnowledgeSnapshot {
    return Object.freeze({
      snapshotId: snapshot.snapshotId,
      sourceId: snapshot.sourceId,
      sourceType: snapshot.sourceType,
      sourcePath: snapshot.sourcePath,
      createdAt: snapshot.createdAt,
      entityCounts: snapshot.entityCounts,
      warnings: snapshot.warnings,
      totalEntityCount: snapshot.totalEntityCount,
      loadedCollectionCount: snapshot.loadedCollectionCount,
      supportedCollectionCount: snapshot.supportedCollectionCount,
    });
  }
}

/** Create a generic knowledge service backed by a read-only source adapter. */
export async function createKnowledgeService(
  options?: KnowledgeServiceOptions,
): Promise<KnowledgeService> {
  const service = new KnowledgeServiceImpl(options);
  await service.getSnapshot();
  return service;
}
