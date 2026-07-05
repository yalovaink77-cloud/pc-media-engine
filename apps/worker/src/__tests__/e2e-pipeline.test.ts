import type { PublishingFlowResult } from '@pcme/publishing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DispatchDeps } from '../processors/dispatch.js';
import { dispatchJob } from '../processors/dispatch.js';
import { processPublishingJob } from '../processors/publishing.processor.js';
import { thumbnailProcessor } from '../processors/thumbnail.processor.js';

vi.mock('../processors/thumbnail.processor.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../processors/thumbnail.processor.js')>();
  return { ...mod, thumbnailProcessor: vi.fn().mockResolvedValue(undefined) };
});

function makeMockJob() {
  return {
    id: 'job-e2e-001',
    organizationId: 'org-001',
    projectId: 'proj-001',
    assetId: 'asset-001',
    processingType: 'thumbnail',
    status: 'pending',
    priority: 0,
    retryCount: 0,
    requestedAt: new Date(),
    startedAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeMockAttempt() {
  return {
    id: 'attempt-e2e-001',
    organizationId: 'org-001',
    projectId: 'proj-001',
    processingJobId: 'job-e2e-001',
    attemptNumber: 1,
    status: 'running',
    startedAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('offline end-to-end pipeline (mock)', () => {
  let capturedPayload: Record<string, unknown> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedPayload = undefined;
    (thumbnailProcessor as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('processing completion enqueues publishing job with enriched payload', async () => {
    const thumbBuffer = Buffer.from('mock-webp');

    const deps: DispatchDeps = {
      jobRepo: {
        findByIdGlobal: vi.fn().mockResolvedValue(makeMockJob()),
        update: vi.fn().mockResolvedValue(null),
      },
      attemptRepo: {
        nextAttemptNumber: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue(makeMockAttempt()),
        update: vi.fn().mockResolvedValue(null),
      },
      assetRepo: {
        findByIdGlobal: vi.fn().mockResolvedValue({
          id: 'asset-001',
          filename: 'e2e-photo.jpg',
          storageKey: 'piercingconnect/asset-001/e2e-photo.jpg',
        }),
      },
      storageProvider: {
        get: vi.fn().mockResolvedValue(thumbBuffer),
        put: vi.fn(),
      },
      artifactRepo: { upsertByJobAndType: vi.fn().mockResolvedValue({ id: 'artifact-001' }) },
      onThumbnailComplete: async (ctx) => {
        const { enqueuePublishingAfterThumbnail } = await import('../pipeline/post-thumbnail.js');
        await enqueuePublishingAfterThumbnail(ctx, {
          storageProvider: { get: vi.fn().mockResolvedValue(thumbBuffer) },
          publishingEnqueuer: {
            enqueue: vi.fn().mockImplementation(async (payload) => {
              capturedPayload = payload;
            }),
          },
          env: { AI_METADATA_PROVIDER: 'none' },
        });
      },
    };

    await dispatchJob('job-e2e-001', deps);

    expect(capturedPayload).toBeDefined();
    expect(capturedPayload?.['slug']).toBe('e2e-photo');
    expect(capturedPayload?.['title']).toContain('e2e photo');

    const flowResult = await processPublishingJob(capturedPayload as never, {
      publisherDriver: 'mock',
    });
    expect(flowResult.success).toBe(true);
    expect(flowResult.media?.externalId).toMatch(/^media-/);
    expect(flowResult.post?.externalId).toMatch(/^post-/);
  });

  it('publishing worker receives enriched payload from mock AI provider', async () => {
    const payload = {
      title: '[AI] Smoke Test | PiercingConnect',
      slug: 'smoke-test',
      body: '<p>Offline e2e body.</p>',
      mediaData: 'mock-image',
      mediaMimeType: 'image/webp',
      mediaFilename: 'smoke-test_thumb.webp',
    };

    const result: PublishingFlowResult = await processPublishingJob(payload, {
      publisherDriver: 'mock',
    });

    expect(result.success).toBe(true);
    expect(result.post?.externalId).toMatch(/^post-/);
  });
});
