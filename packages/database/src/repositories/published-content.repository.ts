import type { PrismaClient, PublishedContent, PublishedContentStatus } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import { requireProjectId } from './scoped-query.js';

export type FindPublishedContentHistoryOptions = {
  projectId?: string;
  assetId?: string;
  publisher?: string;
  /** Maximum number of records to return. Caller is responsible for clamping. */
  limit: number;
};

export type CreatePublishedContentInput = {
  organizationId: string;
  projectId: string;
  assetId: string;
  slug: string;
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
        slug: input.slug.trim(),
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

  /**
   * Find the latest record matching (projectId, publisher, slug).
   * Used for duplicate detection before publishing.
   */
  findDuplicate(
    projectId: string,
    publisher: string,
    slug: string,
  ): Promise<PublishedContent | null> {
    return this.client.publishedContent.findFirst({
      where: {
        projectId: requireProjectId(projectId),
        publisher: publisher.trim(),
        slug: slug.trim(),
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Paginated history with optional filters — used by the publishing API.
   * Ordered newest-first. Caller is responsible for validating/clamping limit.
   */
  findHistory(opts: FindPublishedContentHistoryOptions): Promise<PublishedContent[]> {
    const where: Record<string, unknown> = {};
    if (opts.projectId) where['projectId'] = requireProjectId(opts.projectId);
    if (opts.assetId) where['assetId'] = opts.assetId.trim();
    if (opts.publisher) where['publisher'] = opts.publisher.trim();

    return this.client.publishedContent.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: opts.limit,
    });
  }

  /**
   * Look up a single published-content record by its primary key.
   * Returns null when not found (route maps to 404).
   */
  findById(id: string): Promise<PublishedContent | null> {
    return this.client.publishedContent.findUnique({ where: { id: id.trim() } });
  }
}
