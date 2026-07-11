import {
  PublishingOutboxConcurrencyError,
  PublishingOutboxDuplicateError,
  PublishingOutboxNotFoundError,
} from '@pcme/shared';
import type {
  PrismaClient,
  PublishingHandoffAttemptRecord,
  PublishingHandoffOutboxRecord,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDeterministicOutboxId,
  PrismaPublishingOutboxRepository,
} from './publishing-outbox.repository.js';
import { buildSampleHandoffPackagePayload } from './publishing-outbox.test-fixtures.js';

const PROJECT_ID = 'proj_1';
const ORG_ID = 'org_1';
const CONTEXT = Object.freeze({ organizationId: ORG_ID, projectId: PROJECT_ID });
const PACKAGE = buildSampleHandoffPackagePayload();

function makeOutboxRecord(
  overrides?: Partial<PublishingHandoffOutboxRecord>,
): PublishingHandoffOutboxRecord {
  const now = new Date('2026-07-10T12:00:00.000Z');
  return {
    id: 'db-outbox-1',
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    outboxId: buildDeterministicOutboxId(PACKAGE.handoffId),
    handoffId: PACKAGE.handoffId,
    artifactId: PACKAGE.artifactId,
    reviewId: PACKAGE.reviewId,
    jobId: PACKAGE.jobId,
    requestId: PACKAGE.requestId,
    sourceId: PACKAGE.sourceId,
    snapshotId: PACKAGE.snapshotId,
    targetId: PACKAGE.target.targetId,
    contentType: PACKAGE.contentType,
    locale: PACKAGE.locale,
    format: PACKAGE.format,
    packagePayload: PACKAGE,
    status: 'pending',
    priority: 0,
    scheduledAt: null,
    availableAt: now,
    lockedAt: null,
    lockedBy: null,
    attemptCount: 0,
    maxAttempts: 5,
    lastError: null,
    version: 1,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMockClient(): PrismaClient {
  const client = {
    publishingHandoffOutboxRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    publishingHandoffAttemptRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaClient;

  vi.mocked(client.$transaction).mockImplementation(async (callback) => callback(client));
  return client;
}

describe('PrismaPublishingOutboxRepository', () => {
  let client: PrismaClient;
  let repo: PrismaPublishingOutboxRepository;

  beforeEach(() => {
    client = makeMockClient();
    repo = new PrismaPublishingOutboxRepository(client);
  });

  it('enqueues an outbox record', async () => {
    const record = makeOutboxRecord();
    vi.mocked(client.publishingHandoffOutboxRecord.create).mockResolvedValue(record);

    const result = await repo.enqueue(CONTEXT, { package: PACKAGE });
    expect(result.handoffId).toBe(PACKAGE.handoffId);
    expect(result.status).toBe('pending');
  });

  it('rejects duplicate handoff enqueue', async () => {
    vi.mocked(client.publishingHandoffOutboxRecord.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.3.1',
      }),
    );

    await expect(repo.enqueue(CONTEXT, { package: PACKAGE })).rejects.toBeInstanceOf(
      PublishingOutboxDuplicateError,
    );
  });

  it('claims the next available outbox record transactionally', async () => {
    const record = makeOutboxRecord();
    vi.mocked(client.publishingHandoffOutboxRecord.findFirst).mockResolvedValue(record);
    vi.mocked(client.publishingHandoffOutboxRecord.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(client.publishingHandoffOutboxRecord.findFirstOrThrow).mockResolvedValue({
      ...record,
      status: 'processing',
      lockedBy: 'worker-1',
      version: 2,
    });

    const claimed = await repo.claimNext(CONTEXT, {
      workerId: 'worker-1',
      now: new Date('2026-07-10T12:00:00.000Z'),
    });

    expect(claimed?.status).toBe('processing');
    expect(claimed?.lockedBy).toBe('worker-1');
  });

  it('returns undefined when concurrent claim loses the race', async () => {
    vi.mocked(client.publishingHandoffOutboxRecord.findFirst).mockResolvedValue(makeOutboxRecord());
    vi.mocked(client.publishingHandoffOutboxRecord.updateMany).mockResolvedValue({ count: 0 });

    const claimed = await repo.claimNext(CONTEXT, { workerId: 'worker-1' });
    expect(claimed).toBeUndefined();
  });

  it('does not claim scheduled records before scheduledAt', async () => {
    vi.mocked(client.publishingHandoffOutboxRecord.findFirst).mockResolvedValue(null);
    const claimed = await repo.claimNext(CONTEXT, {
      workerId: 'worker-1',
      now: new Date('2026-07-10T11:00:00.000Z'),
    });
    expect(claimed).toBeUndefined();
  });

  it('marks outbox records as succeeded', async () => {
    const record = makeOutboxRecord({ status: 'processing', version: 2 });
    vi.mocked(client.publishingHandoffOutboxRecord.findFirst).mockResolvedValue(record);
    vi.mocked(client.publishingHandoffOutboxRecord.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(client.publishingHandoffOutboxRecord.findFirstOrThrow).mockResolvedValue({
      ...record,
      status: 'succeeded',
      version: 3,
      completedAt: new Date('2026-07-10T12:05:00.000Z'),
    });
    vi.mocked(client.publishingHandoffAttemptRecord.create).mockResolvedValue(
      {} as PublishingHandoffAttemptRecord,
    );

    const result = await repo.markSucceeded(CONTEXT, {
      outboxId: record.outboxId,
      expectedVersion: 2,
      attempt: {
        attemptNumber: 1,
        providerId: 'wordpress',
        startedAt: '2026-07-10T12:00:00.000Z',
        completedAt: '2026-07-10T12:05:00.000Z',
        status: 'succeeded',
        remoteContentId: '123',
        remoteUrl: 'https://example.test/post',
      },
    });

    expect(result.status).toBe('succeeded');
  });

  it('marks retryable failures and schedules availableAt', async () => {
    const record = makeOutboxRecord({ status: 'processing', version: 2 });
    vi.mocked(client.publishingHandoffOutboxRecord.findFirst).mockResolvedValue(record);
    vi.mocked(client.publishingHandoffOutboxRecord.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(client.publishingHandoffOutboxRecord.findFirstOrThrow).mockResolvedValue({
      ...record,
      status: 'failed',
      attemptCount: 1,
      version: 3,
      availableAt: new Date('2026-07-10T12:00:05.000Z'),
    });
    vi.mocked(client.publishingHandoffAttemptRecord.create).mockResolvedValue(
      {} as PublishingHandoffAttemptRecord,
    );

    const result = await repo.markFailed(CONTEXT, {
      outboxId: record.outboxId,
      expectedVersion: 2,
      errorCode: 'timeout',
      retryable: true,
      message: 'Provider timeout',
      attempt: {
        attemptNumber: 1,
        providerId: 'wordpress',
        startedAt: '2026-07-10T12:00:00.000Z',
        completedAt: '2026-07-10T12:00:01.000Z',
        status: 'failed',
      },
      now: new Date('2026-07-10T12:00:01.000Z'),
    });

    expect(result.status).toBe('failed');
    expect(result.attemptCount).toBe(1);
  });

  it('moves exhausted failures to dead-letter', async () => {
    const record = makeOutboxRecord({
      status: 'processing',
      version: 2,
      attemptCount: 4,
      maxAttempts: 5,
    });
    vi.mocked(client.publishingHandoffOutboxRecord.findFirst).mockResolvedValue(record);
    vi.mocked(client.publishingHandoffOutboxRecord.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(client.publishingHandoffOutboxRecord.findFirstOrThrow).mockResolvedValue({
      ...record,
      status: 'dead_letter',
      attemptCount: 5,
      version: 3,
    });
    vi.mocked(client.publishingHandoffAttemptRecord.create).mockResolvedValue(
      {} as PublishingHandoffAttemptRecord,
    );

    const result = await repo.markFailed(CONTEXT, {
      outboxId: record.outboxId,
      expectedVersion: 2,
      errorCode: 'validation',
      retryable: false,
      message: 'Invalid payload',
      attempt: {
        attemptNumber: 5,
        providerId: 'wordpress',
        startedAt: '2026-07-10T12:00:00.000Z',
        completedAt: '2026-07-10T12:00:01.000Z',
        status: 'failed',
      },
    });

    expect(result.status).toBe('dead-letter');
  });

  it('appends attempt history', async () => {
    vi.mocked(client.publishingHandoffAttemptRecord.create).mockResolvedValue({
      id: 'attempt-1',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      attemptId: 'attempt-id-1',
      outboxId: buildDeterministicOutboxId(PACKAGE.handoffId),
      attemptNumber: 1,
      providerId: 'wordpress',
      status: 'started',
      errorCode: null,
      retryable: null,
      diagnostics: null,
      remoteContentId: null,
      remoteUrl: null,
      startedAt: new Date('2026-07-10T12:00:00.000Z'),
      completedAt: null,
      createdAt: new Date('2026-07-10T12:00:00.000Z'),
    });

    const attempt = await repo.appendAttempt(CONTEXT, {
      outboxId: buildDeterministicOutboxId(PACKAGE.handoffId),
      attempt: {
        attemptNumber: 1,
        providerId: 'wordpress',
        startedAt: '2026-07-10T12:00:00.000Z',
        status: 'started',
      },
    });

    expect(attempt.attemptNumber).toBe(1);
  });

  it('rejects blocked metadata on enqueue', async () => {
    await expect(
      repo.enqueue(CONTEXT, {
        package: buildSampleHandoffPackagePayload({
          content: 'template_path=/home/user/secret.yaml',
        }),
      }),
    ).rejects.toThrow();
  });

  it('throws concurrency errors on stale version updates', async () => {
    vi.mocked(client.publishingHandoffOutboxRecord.findFirst).mockResolvedValue(
      makeOutboxRecord({ status: 'processing', version: 2 }),
    );
    vi.mocked(client.publishingHandoffOutboxRecord.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      repo.markSucceeded(CONTEXT, {
        outboxId: buildDeterministicOutboxId(PACKAGE.handoffId),
        expectedVersion: 2,
        attempt: {
          attemptNumber: 1,
          providerId: 'wordpress',
          startedAt: '2026-07-10T12:00:00.000Z',
          status: 'succeeded',
        },
      }),
    ).rejects.toBeInstanceOf(PublishingOutboxConcurrencyError);
  });

  it('throws when outbox record is missing', async () => {
    vi.mocked(client.publishingHandoffOutboxRecord.findFirst).mockResolvedValue(null);

    await expect(
      repo.markSucceeded(CONTEXT, {
        outboxId: 'missing',
        expectedVersion: 1,
        attempt: {
          attemptNumber: 1,
          providerId: 'wordpress',
          startedAt: '2026-07-10T12:00:00.000Z',
          status: 'succeeded',
        },
      }),
    ).rejects.toBeInstanceOf(PublishingOutboxNotFoundError);
  });
});
