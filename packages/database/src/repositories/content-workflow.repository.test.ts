import { randomUUID } from 'node:crypto';

import type {
  ContentReviewRequest,
  GeneratedContentArtifact,
  GenerationPolicySnapshot,
} from '@pcme/shared';
import {
  ContentReviewConcurrencyError,
  ContentReviewNotFoundError,
  ContentReviewTerminalStateError,
  GeneratedContentArtifactDuplicateError,
  GeneratedContentArtifactNotFoundError,
} from '@pcme/shared';
import type {
  ContentReviewEvent,
  ContentReviewRecord,
  GeneratedContentArtifactRecord,
  PrismaClient,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PrismaContentReviewRepository,
  PrismaGeneratedContentArtifactRepository,
} from './content-workflow.repository.js';

const PROJECT_ID = 'proj_1';
const ORG_ID = 'org_1';
const CONTEXT = Object.freeze({ organizationId: ORG_ID, projectId: PROJECT_ID });
const ARTIFACT_ID = 'artifact-001';
const REVIEW_ID = 'review-001';
const JOB_ID = 'job-001';

const policySnapshot: GenerationPolicySnapshot = Object.freeze({
  safetyConstraints: Object.freeze(['no-diagnosis']),
  affiliateConstraints: Object.freeze(['disclose-affiliate']),
  citationRequirements: Object.freeze(['cite-sources']),
  blockedFields: Object.freeze(['sourcePath']),
  strictMode: false,
  contextComplete: true,
  warningCount: 0,
});

const sampleArtifact: GeneratedContentArtifact = Object.freeze({
  artifactId: ARTIFACT_ID,
  jobId: JOB_ID,
  requestId: 'request-001',
  sourceId: 'source-001',
  snapshotId: 'snapshot-001',
  providerId: 'fake-provider',
  contentType: 'product-review',
  locale: 'en-US',
  tone: 'balanced',
  format: 'markdown',
  content: '# Review\nBalanced product guidance.',
  warnings: Object.freeze([]),
  policySnapshot,
  status: 'generated',
  createdAt: '2026-07-10T12:00:00.000Z',
});

const artifactRecord: GeneratedContentArtifactRecord = {
  id: 'db-artifact-1',
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  artifactId: ARTIFACT_ID,
  jobId: JOB_ID,
  requestId: 'request-001',
  sourceId: 'source-001',
  snapshotId: 'snapshot-001',
  providerId: 'fake-provider',
  model: null,
  contentType: 'product-review',
  locale: 'en-US',
  tone: 'balanced',
  format: 'markdown',
  content: '# Review\nBalanced product guidance.',
  status: 'generated',
  usage: null,
  finishReason: null,
  warnings: [],
  policySnapshot,
  createdAt: new Date('2026-07-10T12:00:00.000Z'),
  updatedAt: new Date('2026-07-10T12:00:00.000Z'),
};

const reviewRequest: ContentReviewRequest = Object.freeze({
  reviewId: REVIEW_ID,
  artifactId: ARTIFACT_ID,
  jobId: JOB_ID,
  contentType: 'product-review',
  locale: 'en-US',
  artifactStatus: 'generated',
  policySnapshot,
  warnings: Object.freeze([]),
  requiredChecks: Object.freeze(['safety']),
  status: 'pending-review',
  createdAt: '2026-07-10T12:00:00.000Z',
  expiresAt: '2026-07-11T12:00:00.000Z',
});

function makeReviewRecord(overrides?: Partial<ContentReviewRecord>): ContentReviewRecord {
  return {
    id: 'db-review-1',
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    reviewId: REVIEW_ID,
    artifactId: ARTIFACT_ID,
    jobId: JOB_ID,
    contentType: 'product-review',
    locale: 'en-US',
    status: 'pending_review',
    artifactStatus: 'generated',
    policySnapshot,
    warnings: [],
    requiredChecks: ['safety'],
    version: 1,
    expiresAt: new Date('2026-07-11T12:00:00.000Z'),
    createdAt: new Date('2026-07-10T12:00:00.000Z'),
    updatedAt: new Date('2026-07-10T12:00:00.000Z'),
    ...overrides,
  };
}

function makeCreatedEvent(): ContentReviewEvent {
  return {
    id: 'event-1',
    organizationId: ORG_ID,
    projectId: PROJECT_ID,
    eventId: randomUUID(),
    reviewId: REVIEW_ID,
    eventType: 'created',
    previousStatus: null,
    nextStatus: 'pending_review',
    decision: null,
    reviewer: null,
    notes: null,
    findings: null,
    createdAt: new Date('2026-07-10T12:00:00.000Z'),
  };
}

function makeMockClient(): PrismaClient {
  const client = {
    generatedContentArtifactRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    contentReviewRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    contentReviewEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaClient;

  vi.mocked(client.$transaction).mockImplementation(async (callback) => callback(client));

  return client;
}

describe('PrismaGeneratedContentArtifactRepository', () => {
  let client: PrismaClient;
  let repo: PrismaGeneratedContentArtifactRepository;

  beforeEach(() => {
    client = makeMockClient();
    repo = new PrismaGeneratedContentArtifactRepository(client);
  });

  it('saves and retrieves an artifact', async () => {
    vi.mocked(client.generatedContentArtifactRecord.create).mockResolvedValue(artifactRecord);
    vi.mocked(client.generatedContentArtifactRecord.findFirst).mockResolvedValue(artifactRecord);

    const saved = await repo.save(CONTEXT, sampleArtifact);
    const loaded = await repo.getById(CONTEXT, ARTIFACT_ID);

    expect(saved.artifactId).toBe(ARTIFACT_ID);
    expect(loaded?.content).toBe(sampleArtifact.content);
  });

  it('rejects duplicate artifact saves', async () => {
    vi.mocked(client.generatedContentArtifactRecord.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.3.1',
      }),
    );

    await expect(repo.save(CONTEXT, sampleArtifact)).rejects.toBeInstanceOf(
      GeneratedContentArtifactDuplicateError,
    );
  });

  it('lists artifacts by job id', async () => {
    vi.mocked(client.generatedContentArtifactRecord.findMany).mockResolvedValue([artifactRecord]);

    const results = await repo.listByJobId(CONTEXT, JOB_ID);
    expect(results).toHaveLength(1);
    expect(results[0]?.jobId).toBe(JOB_ID);
  });

  it('updates artifact status', async () => {
    vi.mocked(client.generatedContentArtifactRecord.findFirst).mockResolvedValue(artifactRecord);
    vi.mocked(client.generatedContentArtifactRecord.update).mockResolvedValue({
      ...artifactRecord,
      status: 'approved',
    });

    const updated = await repo.updateStatus(CONTEXT, ARTIFACT_ID, 'approved');
    expect(updated.status).toBe('approved');
  });

  it('throws when updating a missing artifact', async () => {
    vi.mocked(client.generatedContentArtifactRecord.findFirst).mockResolvedValue(null);

    await expect(repo.updateStatus(CONTEXT, 'missing', 'approved')).rejects.toBeInstanceOf(
      GeneratedContentArtifactNotFoundError,
    );
  });
  it('rejects blocked metadata before save', async () => {
    await expect(
      repo.save(CONTEXT, {
        ...sampleArtifact,
        content: 'template_path=/home/user/secret.yaml',
      }),
    ).rejects.toThrow();
  });
});

describe('PrismaContentReviewRepository', () => {
  let client: PrismaClient;
  let repo: PrismaContentReviewRepository;

  beforeEach(() => {
    client = makeMockClient();
    repo = new PrismaContentReviewRepository(client);
  });

  it('creates a review with an append-only created event', async () => {
    const reviewRecord = makeReviewRecord();
    const createdEvent = makeCreatedEvent();

    vi.mocked(client.contentReviewRecord.create).mockResolvedValue(reviewRecord);
    vi.mocked(client.contentReviewEvent.create).mockResolvedValue(createdEvent);

    const result = await repo.create(CONTEXT, reviewRequest);

    expect(result.review.reviewId).toBe(REVIEW_ID);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.type).toBe('created');
  });

  it('persists review decisions append-only', async () => {
    const reviewRecord = makeReviewRecord();
    const createdEvent = makeCreatedEvent();
    const decisionEvent: ContentReviewEvent = {
      ...createdEvent,
      id: 'event-2',
      eventId: randomUUID(),
      eventType: 'decision_submitted',
      previousStatus: 'pending_review',
      nextStatus: 'approved',
      decision: 'approve',
      reviewer: { reviewerId: 'reviewer-1' },
      notes: 'Looks good',
      findings: [],
      createdAt: new Date('2026-07-10T12:05:00.000Z'),
    };

    vi.mocked(client.contentReviewRecord.findFirst).mockResolvedValue(reviewRecord);
    vi.mocked(client.contentReviewRecord.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(client.contentReviewEvent.create).mockResolvedValue(decisionEvent);
    vi.mocked(client.contentReviewRecord.findFirstOrThrow).mockResolvedValue({
      ...reviewRecord,
      status: 'approved',
      version: 2,
    });
    vi.mocked(client.contentReviewEvent.findMany).mockResolvedValue([createdEvent, decisionEvent]);

    const result = await repo.appendDecision(CONTEXT, {
      reviewId: REVIEW_ID,
      decision: 'approve',
      reviewer: { reviewerId: 'reviewer-1' },
      notes: 'Looks good',
      expectedVersion: 1,
      nowMs: Date.parse('2026-07-10T12:05:00.000Z'),
    });

    expect(result.review.status).toBe('approved');
    expect(result.history.some((event) => event.type === 'decision-submitted')).toBe(true);
  });

  it('enforces optimistic concurrency on review decisions', async () => {
    vi.mocked(client.contentReviewRecord.findFirst).mockResolvedValue(makeReviewRecord());
    vi.mocked(client.contentReviewRecord.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      repo.appendDecision(CONTEXT, {
        reviewId: REVIEW_ID,
        decision: 'approve',
        reviewer: { reviewerId: 'reviewer-1' },
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ContentReviewConcurrencyError);
  });

  it('protects terminal review states', async () => {
    vi.mocked(client.contentReviewRecord.findFirst).mockResolvedValue(
      makeReviewRecord({ status: 'approved', version: 2 }),
    );

    await expect(
      repo.appendDecision(CONTEXT, {
        reviewId: REVIEW_ID,
        decision: 'approve',
        reviewer: { reviewerId: 'reviewer-1' },
        expectedVersion: 2,
      }),
    ).rejects.toBeInstanceOf(ContentReviewTerminalStateError);
  });

  it('reopens a review after revision', async () => {
    const reviewRecord = makeReviewRecord({ status: 'changes_requested', version: 2 });
    const createdEvent = makeCreatedEvent();
    const reopenedEvent: ContentReviewEvent = {
      ...createdEvent,
      id: 'event-3',
      eventId: randomUUID(),
      eventType: 'reopened',
      previousStatus: 'changes_requested',
      nextStatus: 'pending_review',
      createdAt: new Date('2026-07-10T13:00:00.000Z'),
    };

    vi.mocked(client.contentReviewRecord.findFirst).mockResolvedValue(reviewRecord);
    vi.mocked(client.contentReviewRecord.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(client.contentReviewEvent.create).mockResolvedValue(reopenedEvent);
    vi.mocked(client.contentReviewRecord.findFirstOrThrow).mockResolvedValue({
      ...reviewRecord,
      status: 'pending_review',
      version: 3,
    });
    vi.mocked(client.contentReviewEvent.findMany).mockResolvedValue([createdEvent, reopenedEvent]);

    const result = await repo.reopenAfterRevision(CONTEXT, REVIEW_ID, { expectedVersion: 2 });
    expect(result.review.status).toBe('pending-review');
  });

  it('lists review history in chronological order', async () => {
    const createdEvent = makeCreatedEvent();
    vi.mocked(client.contentReviewEvent.findMany).mockResolvedValue([createdEvent]);

    const history = await repo.listHistory(CONTEXT, REVIEW_ID);
    expect(history).toHaveLength(1);
    expect(history[0]?.type).toBe('created');
  });

  it('throws when review is missing', async () => {
    vi.mocked(client.contentReviewRecord.findFirst).mockResolvedValue(null);

    await expect(
      repo.appendDecision(CONTEXT, {
        reviewId: 'missing',
        decision: 'approve',
        reviewer: { reviewerId: 'reviewer-1' },
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ContentReviewNotFoundError);
  });
});
