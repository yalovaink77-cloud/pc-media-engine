import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DispatchDeps } from '../processors/dispatch.js';
import { dispatchJob } from '../processors/dispatch.js';
import { thumbnailProcessor } from '../processors/thumbnail.processor.js';

// ---------------------------------------------------------------------------
// Mock thumbnailProcessor so dispatch tests don't need real Sharp/storage
// ---------------------------------------------------------------------------

vi.mock('../processors/thumbnail.processor.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../processors/thumbnail.processor.js')>();
  return { ...mod, thumbnailProcessor: vi.fn().mockResolvedValue(undefined) };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMockJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'job-dispatch-001',
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
    ...overrides,
  };
}

function makeMockAttempt() {
  return {
    id: 'attempt-dispatch-001',
    organizationId: 'org-001',
    projectId: 'proj-001',
    processingJobId: 'job-dispatch-001',
    attemptNumber: 1,
    status: 'running',
    startedAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeDeps(): DispatchDeps {
  return {
    jobRepo: {
      findByIdGlobal: vi.fn().mockResolvedValue(makeMockJob()),
      update: vi.fn().mockResolvedValue(null),
    },
    attemptRepo: {
      nextAttemptNumber: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(makeMockAttempt()),
      update: vi.fn().mockResolvedValue(null),
    },
    assetRepo: { findByIdGlobal: vi.fn().mockResolvedValue({ id: 'asset-001' }) },
    storageProvider: { get: vi.fn(), put: vi.fn() },
    artifactRepo: { upsertByJobAndType: vi.fn().mockResolvedValue({ id: 'artifact-001' }) },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dispatchJob', () => {
  let deps: DispatchDeps;

  beforeEach(() => {
    deps = makeDeps();
    vi.clearAllMocks();
    // Re-establish defaults after clearAllMocks
    (deps.jobRepo.findByIdGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(makeMockJob());
    (deps.jobRepo.update as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (deps.attemptRepo.nextAttemptNumber as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (deps.attemptRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue(makeMockAttempt());
    (deps.attemptRepo.update as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (thumbnailProcessor as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('resolves for a thumbnail job', async () => {
    await expect(dispatchJob('job-dispatch-001', deps)).resolves.toBeUndefined();
  });

  it('throws when job is not found', async () => {
    (deps.jobRepo.findByIdGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(dispatchJob('nonexistent', deps)).rejects.toThrow('ProcessingJob not found');
  });

  it('marks job running before calling thumbnailProcessor', async () => {
    const order: string[] = [];
    (deps.jobRepo.update as ReturnType<typeof vi.fn>).mockImplementation(
      (_pid: string, _id: string, input: { status?: string }) => {
        order.push(`job.update(${input.status ?? '?'})`);
        return Promise.resolve(null);
      },
    );
    (thumbnailProcessor as ReturnType<typeof vi.fn>).mockImplementation(() => {
      order.push('thumbnailProcessor');
      return Promise.resolve();
    });
    await dispatchJob('job-dispatch-001', deps);
    expect(order[0]).toBe('job.update(running)');
    expect(order).toContain('thumbnailProcessor');
  });

  it('creates one ProcessingJobAttempt', async () => {
    await dispatchJob('job-dispatch-001', deps);
    expect(deps.attemptRepo.create).toHaveBeenCalledTimes(1);
  });

  it('marks attempt completed after success', async () => {
    await dispatchJob('job-dispatch-001', deps);
    const calls = (deps.attemptRepo.update as ReturnType<typeof vi.fn>).mock.calls;
    const completed = calls.find((c) => (c[2] as { status?: string }).status === 'completed');
    expect(completed).toBeDefined();
  });

  it('marks job completed after success', async () => {
    await dispatchJob('job-dispatch-001', deps);
    const calls = (deps.jobRepo.update as ReturnType<typeof vi.fn>).mock.calls;
    const completed = calls.find((c) => (c[2] as { status?: string }).status === 'completed');
    expect(completed).toBeDefined();
  });

  it('marks attempt failed when thumbnailProcessor throws', async () => {
    (thumbnailProcessor as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('sharp fail'));
    await expect(dispatchJob('job-dispatch-001', deps)).rejects.toThrow('sharp fail');
    const calls = (deps.attemptRepo.update as ReturnType<typeof vi.fn>).mock.calls;
    const failed = calls.find((c) => (c[2] as { status?: string }).status === 'failed');
    expect(failed).toBeDefined();
  });

  it('marks job failed when thumbnailProcessor throws', async () => {
    (thumbnailProcessor as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('sharp fail'));
    await expect(dispatchJob('job-dispatch-001', deps)).rejects.toThrow('sharp fail');
    const calls = (deps.jobRepo.update as ReturnType<typeof vi.fn>).mock.calls;
    const failed = calls.find((c) => (c[2] as { status?: string }).status === 'failed');
    expect(failed).toBeDefined();
  });

  it('records failureReason on job failure', async () => {
    (thumbnailProcessor as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    await expect(dispatchJob('job-dispatch-001', deps)).rejects.toThrow();
    const calls = (deps.jobRepo.update as ReturnType<typeof vi.fn>).mock.calls;
    const failed = calls.find((c) => (c[2] as { status?: string }).status === 'failed');
    expect((failed?.[2] as { failureReason?: string }).failureReason).toBe('boom');
  });

  it('calls thumbnailProcessor for processingType=thumbnail', async () => {
    await dispatchJob('job-dispatch-001', deps);
    expect(thumbnailProcessor).toHaveBeenCalledTimes(1);
  });

  it('completes as no-op for unknown processingType (no crash)', async () => {
    (deps.jobRepo.findByIdGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockJob({ processingType: 'unknown_type' }),
    );
    await expect(dispatchJob('job-dispatch-001', deps)).resolves.toBeUndefined();
    // thumbnailProcessor should NOT have been called
    expect(thumbnailProcessor).not.toHaveBeenCalled();
  });

  it('calls onThumbnailComplete after successful thumbnail processing', async () => {
    const onThumbnailComplete = vi.fn().mockResolvedValue(undefined);
    (deps.assetRepo.findByIdGlobal as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'asset-001',
      filename: 'photo.jpg',
      storageKey: 'piercingconnect/asset-001/photo.jpg',
    });

    await dispatchJob('job-dispatch-001', { ...deps, onThumbnailComplete });

    expect(onThumbnailComplete).toHaveBeenCalledTimes(1);
    expect(onThumbnailComplete).toHaveBeenCalledWith({
      organizationId: 'org-001',
      projectId: 'proj-001',
      assetId: 'asset-001',
      processingJobId: 'job-dispatch-001',
      asset: { filename: 'photo.jpg', storageKey: 'piercingconnect/asset-001/photo.jpg' },
      thumbnailKey: 'piercingconnect/asset-001/photo_thumb.webp',
    });
  });

  it('does not call onThumbnailComplete when thumbnailProcessor fails', async () => {
    const onThumbnailComplete = vi.fn().mockResolvedValue(undefined);
    (thumbnailProcessor as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    await expect(dispatchJob('job-dispatch-001', { ...deps, onThumbnailComplete })).rejects.toThrow(
      'fail',
    );

    expect(onThumbnailComplete).not.toHaveBeenCalled();
  });
});
