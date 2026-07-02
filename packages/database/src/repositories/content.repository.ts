import type { Asset, ContentItem, PrismaClient } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import { activeRecordsFilter, requireProjectId } from './scoped-query.js';

export class ContentItemRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  findById(projectId: string, contentItemId: string): Promise<ContentItem | null> {
    return this.client.contentItem.findFirst({
      where: {
        id: contentItemId,
        projectId: requireProjectId(projectId),
        ...activeRecordsFilter(),
      },
    });
  }

  listByProject(projectId: string): Promise<ContentItem[]> {
    return this.client.contentItem.findMany({
      where: {
        projectId: requireProjectId(projectId),
        ...activeRecordsFilter(),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

export class AssetRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  findById(projectId: string, assetId: string): Promise<Asset | null> {
    return this.client.asset.findFirst({
      where: {
        id: assetId,
        projectId: requireProjectId(projectId),
        ...activeRecordsFilter(),
      },
    });
  }

  listByProject(projectId: string): Promise<Asset[]> {
    return this.client.asset.findMany({
      where: {
        projectId: requireProjectId(projectId),
        ...activeRecordsFilter(),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
