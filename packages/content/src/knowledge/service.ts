import { CommerceKnowledgeSourceAdapter } from './adapters/commerce-adapter.js';
import { KnowledgeEntityNotFoundError } from './errors.js';
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
  KnowledgeEntity,
  KnowledgeService,
  KnowledgeServiceOptions,
  KnowledgeSnapshot,
  KnowledgeSourceAdapter,
} from './types.js';

interface SnapshotState extends KnowledgeSnapshot {
  readonly indexes: KnowledgeIndexes;
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
    const snapshot = await this.loadSnapshot();
    const entity = lookupEntity(snapshot.indexes, type, id);
    if (!entity && this.strict) {
      throw new KnowledgeEntityNotFoundError({ type, id });
    }
    return entity;
  }

  async getEntityBySlug(type: EntityType, slug: string): Promise<KnowledgeEntity | undefined> {
    const snapshot = await this.loadSnapshot();
    const entity = lookupEntityBySlug(snapshot.indexes, type, slug);
    if (!entity && this.strict) {
      throw new KnowledgeEntityNotFoundError({ type, id: slug });
    }
    return entity;
  }

  async getEntitiesByType(type: EntityType): Promise<readonly KnowledgeEntity[]> {
    const snapshot = await this.loadSnapshot();
    return snapshot.indexes.byType.get(type) ?? Object.freeze([]);
  }

  async getRelatedEntities(
    reference: EntityReference,
    relation: string,
  ): Promise<readonly KnowledgeEntity[]> {
    const snapshot = await this.loadSnapshot();
    if (this.strict && !lookupEntity(snapshot.indexes, reference.type, reference.id)) {
      throw new KnowledgeEntityNotFoundError(reference);
    }
    return lookupRelatedEntities(snapshot.indexes, reference, relation);
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
