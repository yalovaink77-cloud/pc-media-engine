import type { PrismaClient, PublishedContent, PublishedContentStatus } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import { requireProjectId } from './scoped-query.js';

export type CreatePublishedContentInput = {
  organizationId: string;
  projectId: string;
  assetId: string;
  publisher: string;
  externalId: string;
  url: string;
  status: PublishedContentStatus;
  publishedAt: Date;
};

export class PublishedContentRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  create(input: CreatePublishedContentInput): Promise<PublishedContent> {
    return this.client.publishedContent.create({
      data: {
        organizationId: input.organizationId,
        projectId: requireProjectId(input.projectId),
        assetId: input.assetId,
        publisher: input.publisher.trim(),
        externalId: input.externalId.trim(),
        url: input.url.trim(),
        status: input.status,
        publishedAt: input.publishedAt,
      },
    });
  }

  findByAsset(projectId: string, assetId: string): Promise<PublishedContent[]> {
    return this.client.publishedContent.findMany({
      where: { projectId: requireProjectId(projectId), assetId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  findLatestByAsset(projectId: string, assetId: string): Promise<PublishedContent | null> {
    return this.client.publishedContent.findFirst({
      where: { projectId: requireProjectId(projectId), assetId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  findByExternalId(publisher: string, externalId: string): Promise<PublishedContent | null> {
    return this.client.publishedContent.findFirst({
      where: { publisher: publisher.trim(), externalId: externalId.trim() },
    });
  }

  findLatestByProject(projectId: string): Promise<PublishedContent | null> {
    return this.client.publishedContent.findFirst({
      where: { projectId: requireProjectId(projectId) },
      orderBy: { publishedAt: 'desc' },
    });
  }
}
