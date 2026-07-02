import type { ContentItem, PrismaClient } from '@prisma/client';

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
