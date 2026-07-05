import type { PrismaClient, PublishedContent } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublishedContentRepository } from './published-content.repository.js';

function makeMockClient(): PrismaClient {
  return {
    publishedContent: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  } as unknown as PrismaClient;
}

const PROJECT_ID = 'proj_1';
const ORG_ID = 'org_1';
const ASSET_ID = 'asset_1';
const RECORD_ID = 'pub_1';
const PUBLISHED_AT = new Date('2026-07-05T12:00:00.000Z');

const sampleRecord: PublishedContent = {
  id: RECORD_ID,
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  assetId: ASSET_ID,
  publisher: 'mock',
  externalId: 'post-abc123',
  url: 'https://mock.example.com/posts/abc123',
  status: 'draft',
  publishedAt: PUBLISHED_AT,
  createdAt: new Date('2026-07-05T12:00:01.000Z'),
  updatedAt: new Date('2026-07-05T12:00:01.000Z'),
};

describe('PublishedContentRepository', () => {
  let client: PrismaClient;
  let repo: PublishedContentRepository;

  beforeEach(() => {
    client = makeMockClient();
    repo = new PublishedContentRepository(client);
  });

  it('creates a published content record', async () => {
    vi.mocked(client.publishedContent.create).mockResolvedValue(sampleRecord);

    const result = await repo.create({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      publisher: 'mock',
      externalId: 'post-abc123',
      url: 'https://mock.example.com/posts/abc123',
      status: 'draft',
      publishedAt: PUBLISHED_AT,
    });

    expect(result).toEqual(sampleRecord);
    expect(client.publishedContent.create).toHaveBeenCalledWith({
      data: {
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        assetId: ASSET_ID,
        publisher: 'mock',
        externalId: 'post-abc123',
        url: 'https://mock.example.com/posts/abc123',
        status: 'draft',
        publishedAt: PUBLISHED_AT,
      },
    });
  });

  it('findByAsset scopes to project and orders by publishedAt desc', async () => {
    vi.mocked(client.publishedContent.findMany).mockResolvedValue([sampleRecord]);

    await repo.findByAsset(PROJECT_ID, ASSET_ID);

    expect(client.publishedContent.findMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID, assetId: ASSET_ID },
      orderBy: { publishedAt: 'desc' },
    });
  });

  it('findLatestByAsset returns the newest record for an asset', async () => {
    vi.mocked(client.publishedContent.findFirst).mockResolvedValue(sampleRecord);

    const result = await repo.findLatestByAsset(PROJECT_ID, ASSET_ID);

    expect(result).toEqual(sampleRecord);
    expect(client.publishedContent.findFirst).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID, assetId: ASSET_ID },
      orderBy: { publishedAt: 'desc' },
    });
  });

  it('findByExternalId looks up by publisher and externalId', async () => {
    vi.mocked(client.publishedContent.findFirst).mockResolvedValue(sampleRecord);

    await repo.findByExternalId('wordpress', 'wp-post-42');

    expect(client.publishedContent.findFirst).toHaveBeenCalledWith({
      where: { publisher: 'wordpress', externalId: 'wp-post-42' },
    });
  });

  it('findLatestByProject returns the newest record for a project', async () => {
    vi.mocked(client.publishedContent.findFirst).mockResolvedValue(sampleRecord);

    await repo.findLatestByProject(PROJECT_ID);

    expect(client.publishedContent.findFirst).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID },
      orderBy: { publishedAt: 'desc' },
    });
  });

  it('rejects create when projectId is missing', () => {
    expect(() =>
      repo.create({
        organizationId: ORG_ID,
        projectId: '',
        assetId: ASSET_ID,
        publisher: 'mock',
        externalId: 'post-1',
        url: 'https://mock/posts/1',
        status: 'draft',
        publishedAt: PUBLISHED_AT,
      }),
    ).toThrow('projectId is required');
    expect(client.publishedContent.create).not.toHaveBeenCalled();
  });
});
