import type {
  ProjectScopedPersistenceContext,
  PublishingIdempotencyRecord,
  PublishingIdempotencyRepository,
  PublishingIdempotencyReserveResult,
} from '@pcme/shared';
import { describe, expect, it, vi } from 'vitest';

import { InMemoryWordPressHandoffIdempotencyStore } from '../handoff-idempotency.js';
import {
  buildHandoffPublishRequestHash,
  HandoffPublishIdempotencyGuard,
} from '../handoff-publish-idempotency.js';

const CONTEXT: ProjectScopedPersistenceContext = Object.freeze({
  organizationId: 'org-1',
  projectId: 'proj-1',
});

function makeCompletedRecord(): PublishingIdempotencyRecord {
  const now = '2026-07-10T12:00:00.000Z';
  return Object.freeze({
    idempotencyKey: 'wordpress:handoff-123',
    targetId: 'wordpress',
    handoffId: 'handoff-123',
    requestHash: 'hash-a',
    status: 'completed',
    remoteContentId: '777',
    remoteUrl: 'https://wp.example.com/?p=777',
    firstSeenAt: now,
    lastSeenAt: now,
    completedAt: now,
    expiresAt: undefined,
  });
}

function makeMockRepository(
  overrides: Partial<PublishingIdempotencyRepository> = {},
): PublishingIdempotencyRepository {
  return {
    reserve: vi.fn().mockResolvedValue(Object.freeze({ action: 'proceed' })),
    get: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(makeCompletedRecord()),
    markFailed: vi.fn().mockResolvedValue(makeCompletedRecord()),
    releaseExpired: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('HandoffPublishIdempotencyGuard', () => {
  it('returns prior completed results from persistent storage', async () => {
    const repository = makeMockRepository({
      reserve: vi.fn().mockResolvedValue(
        Object.freeze({
          action: 'return-existing',
          record: makeCompletedRecord(),
        }) satisfies PublishingIdempotencyReserveResult,
      ),
    });
    const guard = new HandoffPublishIdempotencyGuard(
      new InMemoryWordPressHandoffIdempotencyStore(),
      {
        repository,
        context: CONTEXT,
        requestHash: 'hash-a',
      },
    );

    const reservation = await guard.reserve('handoff-123', 'wordpress', 'hash-a');

    expect(reservation).toEqual(
      Object.freeze({
        success: true,
        targetId: 'wordpress',
        externalId: '777',
        url: 'https://wp.example.com/?p=777',
      }),
    );
    expect(repository.reserve).toHaveBeenCalledOnce();
  });

  it('builds a stable request hash', () => {
    const hash = buildHandoffPublishRequestHash({
      handoffId: 'handoff-123',
      targetId: 'wordpress',
      contentLength: 42,
      slug: 'product-review',
    });

    expect(hash).toHaveLength(32);
    expect(hash).toBe(
      buildHandoffPublishRequestHash({
        handoffId: 'handoff-123',
        targetId: 'wordpress',
        contentLength: 42,
        slug: 'product-review',
      }),
    );
  });
});

describe('WordPressPublishingTargetAdapter persistent idempotency', () => {
  it('uses persistent idempotency without requiring database access in unit tests', async () => {
    const { WordPressPublishingTargetAdapter } =
      await import('../wordpress-publishing-target.adapter.js');
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 888,
          link: 'https://wp.example.com/?p=888',
          status: 'draft',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const repository = makeMockRepository({
      reserve: vi
        .fn()
        .mockResolvedValueOnce(Object.freeze({ action: 'proceed' }))
        .mockResolvedValueOnce(
          Object.freeze({
            action: 'return-existing',
            record: Object.freeze({
              ...makeCompletedRecord(),
              remoteContentId: '888',
              remoteUrl: 'https://wp.example.com/?p=888',
            }),
          }),
        ),
    });
    const adapter = new WordPressPublishingTargetAdapter(
      Object.freeze({
        baseUrl: 'https://wp.example.com',
        username: 'editor',
        appPassword: 'secret-app-password-value',
        requestTimeoutMs: 5_000,
        defaultAuthor: '7',
        defaultStatus: 'draft',
      }),
      {
        fetchFn,
        persistentIdempotency: {
          repository,
          context: CONTEXT,
          requestHash: 'hash-a',
        },
      },
    );
    const pkg = Object.freeze({
      handoffId: 'handoff-123',
      artifactId: 'artifact-123',
      reviewId: 'review-123',
      jobId: 'job-123',
      requestId: 'request-123',
      sourceId: 'source-123',
      snapshotId: 'snapshot-123',
      contentType: 'product-review',
      locale: 'en',
      format: 'markdown' as const,
      content: '# Title\n\nBody',
      target: Object.freeze({
        targetId: 'wordpress',
        platform: 'wordpress',
        supportedFormats: Object.freeze(['markdown', 'html']),
      }),
      publishingMetadata: Object.freeze({
        title: 'Product Review',
        slug: 'product-review',
        publishStatus: 'draft' as const,
      }),
      policySnapshot: Object.freeze({
        safetyConstraints: Object.freeze([]),
        affiliateConstraints: Object.freeze([]),
        citationRequirements: Object.freeze([]),
        blockedFields: Object.freeze([]),
        strictMode: false,
        contextComplete: true,
        warningCount: 0,
      }),
      reviewSummary: Object.freeze({
        reviewId: 'review-123',
        status: 'approved' as const,
        decision: 'approve' as const,
        reviewerId: 'reviewer-1',
        findingCount: 0,
      }),
      warnings: Object.freeze([]),
      status: 'ready' as const,
      createdAt: '2026-07-10T12:00:00.000Z',
    });

    const first = await adapter.publish(pkg);
    const second = await adapter.publish(pkg);

    expect(first.success).toBe(true);
    expect(second).toEqual(first);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(repository.markCompleted).toHaveBeenCalledOnce();
  });
});
