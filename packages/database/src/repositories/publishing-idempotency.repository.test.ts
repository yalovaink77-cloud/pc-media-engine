import { PublishingIdempotencyConflictError, PublishingIdempotencyRepository } from '@pcme/shared';
import type { PrismaClient, PublishingIdempotencyRecord as DbRecord } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaPublishingIdempotencyRepository } from './publishing-idempotency.repository.js';

const PROJECT_ID = 'proj_1';
const ORG_ID = 'org_1';
const CONTEXT = Object.freeze({ organizationId: ORG_ID, projectId: PROJECT_ID });

function makeRecord(overrides?: Partial<DbRecord>): DbRecord {
  const now = new Date('2026-07-10T12:00:00.000Z');
  return {
    id: 'idempotency-1',
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    idempotencyKey: 'wordpress:handoff-001',
    targetId: 'wordpress',
    handoffId: 'handoff-001',
    requestHash: 'hash-a',
    status: 'reserved',
    remoteContentId: null,
    remoteUrl: null,
    firstSeenAt: now,
    lastSeenAt: now,
    completedAt: null,
    expiresAt: new Date('2026-07-10T13:00:00.000Z'),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMockClient(): PrismaClient {
  const client = {
    publishingIdempotencyRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaClient;

  vi.mocked(client.$transaction).mockImplementation(async (callback) => callback(client));
  return client;
}

describe('PrismaPublishingIdempotencyRepository', () => {
  let client: PrismaClient;
  let repo: PublishingIdempotencyRepository;

  beforeEach(() => {
    client = makeMockClient();
    repo = new PrismaPublishingIdempotencyRepository(client);
  });

  it('reserves a new idempotency key', async () => {
    vi.mocked(client.publishingIdempotencyRecord.findFirst).mockResolvedValue(null);
    vi.mocked(client.publishingIdempotencyRecord.create).mockResolvedValue(makeRecord());

    const result = await repo.reserve(CONTEXT, {
      targetId: 'wordpress',
      handoffId: 'handoff-001',
      requestHash: 'hash-a',
    });

    expect(result.action).toBe('proceed');
  });

  it('returns prior completed results for duplicate reservations', async () => {
    vi.mocked(client.publishingIdempotencyRecord.findFirst).mockResolvedValue(
      makeRecord({
        status: 'completed',
        remoteContentId: '123',
        remoteUrl: 'https://example.test/post',
      }),
    );

    const result = await repo.reserve(CONTEXT, {
      targetId: 'wordpress',
      handoffId: 'handoff-001',
      requestHash: 'hash-a',
    });

    expect(result.action).toBe('return-existing');
    if (result.action === 'return-existing') {
      expect(result.record.remoteContentId).toBe('123');
    }
  });

  it('rejects conflicting request hashes', async () => {
    vi.mocked(client.publishingIdempotencyRecord.findFirst).mockResolvedValue(makeRecord());

    await expect(
      repo.reserve(CONTEXT, {
        targetId: 'wordpress',
        handoffId: 'handoff-001',
        requestHash: 'hash-b',
      }),
    ).rejects.toBeInstanceOf(PublishingIdempotencyConflictError);
  });

  it('blocks duplicate in-progress reservations', async () => {
    const now = new Date('2026-07-10T12:00:00.000Z');
    vi.mocked(client.publishingIdempotencyRecord.findFirst).mockResolvedValue(makeRecord());

    const result = await repo.reserve(CONTEXT, {
      targetId: 'wordpress',
      handoffId: 'handoff-001',
      requestHash: 'hash-a',
      now,
    });

    expect(result.action).toBe('blocked');
  });

  it('marks completed reservations', async () => {
    vi.mocked(client.publishingIdempotencyRecord.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(client.publishingIdempotencyRecord.findFirstOrThrow).mockResolvedValue(
      makeRecord({
        status: 'completed',
        remoteContentId: '123',
        remoteUrl: 'https://example.test/post',
      }),
    );

    const record = await repo.markCompleted(CONTEXT, {
      idempotencyKey: 'wordpress:handoff-001',
      remoteContentId: '123',
      remoteUrl: 'https://example.test/post',
    });

    expect(record.status).toBe('completed');
  });

  it('releases expired reservations', async () => {
    vi.mocked(client.publishingIdempotencyRecord.updateMany).mockResolvedValue({ count: 2 });

    const released = await repo.releaseExpired(CONTEXT, new Date('2026-07-10T14:00:00.000Z'));

    expect(released).toBe(2);
  });

  it('allows retry after failed reservations', async () => {
    vi.mocked(client.publishingIdempotencyRecord.findFirst).mockResolvedValue(
      makeRecord({ status: 'failed' }),
    );
    vi.mocked(client.publishingIdempotencyRecord.update).mockResolvedValue(
      makeRecord({ status: 'reserved' }),
    );

    const result = await repo.reserve(CONTEXT, {
      targetId: 'wordpress',
      handoffId: 'handoff-001',
      requestHash: 'hash-a',
    });

    expect(result.action).toBe('proceed');
  });

  it('handles create race with duplicate key', async () => {
    vi.mocked(client.publishingIdempotencyRecord.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeRecord({ status: 'completed', remoteContentId: '999' }));
    vi.mocked(client.publishingIdempotencyRecord.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.3.1',
      }),
    );
    vi.mocked(client.publishingIdempotencyRecord.findFirstOrThrow).mockResolvedValue(
      makeRecord({ status: 'completed', remoteContentId: '999' }),
    );

    const result = await repo.reserve(CONTEXT, {
      targetId: 'wordpress',
      handoffId: 'handoff-001',
      requestHash: 'hash-a',
    });

    expect(result.action).toBe('return-existing');
  });
});
