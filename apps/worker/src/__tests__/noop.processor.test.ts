import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ProcessorAttemptRepo,
  ProcessorDeps,
  ProcessorJobRepo,
} from '../processors/noop.processor.js';
import { noopProcessor, ProcessingJobNotFoundError } from '../processors/noop.processor.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMockJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'job-001',
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

function makeMockAttempt(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'attempt-001',
    organizationId: 'org-001',
    projectId: 'proj-001',
    processingJobId: 'job-001',
    attemptNumber: 1,
    status: 'running',
    startedAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<ProcessorDeps> = {}): ProcessorDeps {
  const jobRepo: ProcessorJobRepo = {
    findByIdGlobal: vi.fn().mockResolvedValue(makeMockJob()),
    update: vi.fn().mockResolvedValue(null),
  };

  const attemptRepo: ProcessorAttemptRepo = {
    nextAttemptNumber: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue(makeMockAttempt()),
    update: vi.fn().mockResolvedValue(null),
  };

  return {
    jobRepo: { ...jobRepo, ...overrides.jobRepo },
    attemptRepo: { ...attemptRepo, ...overrides.attemptRepo },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('noopProcessor', () => {
  let deps: ProcessorDeps;

  beforeEach(() => {
    deps = makeDeps();
    vi.clearAllMocks();
    // Re-set defaults after clearAllMocks
    (deps.jobRepo.findByIdGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(makeMockJob());
    (deps.jobRepo.update as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (deps.attemptRepo.nextAttemptNumber as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (deps.attemptRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue(makeMockAttempt());
    (deps.attemptRepo.update as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('resolves successfully for a known job', async () => {
    await expect(noopProcessor('job-001', deps)).resolves.toBeUndefined();
  });

  it('throws ProcessingJobNotFoundError when job is missing', async () => {
    (deps.jobRepo.findByIdGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(noopProcessor('missing-id', deps)).rejects.toThrow(ProcessingJobNotFoundError);
  });

  it('error message contains the job id', async () => {
    (deps.jobRepo.findByIdGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(noopProcessor('ghost-job-xyz', deps)).rejects.toThrow('ghost-job-xyz');
  });

  it('marks the job running before creating the attempt', async () => {
    const callOrder: string[] = [];
    (deps.jobRepo.update as ReturnType<typeof vi.fn>).mockImplementation(
      (_pid: string, _id: string, input: { status?: string }) => {
        callOrder.push(`job.update(${input.status ?? '?'})`);
        return Promise.resolve(null);
      },
    );
    (deps.attemptRepo.create as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push('attempt.create');
      return Promise.resolve(makeMockAttempt());
    });

    await noopProcessor('job-001', deps);

    expect(callOrder[0]).toBe('job.update(running)');
    expect(callOrder[1]).toBe('attempt.create');
  });

  it('creates exactly one ProcessingJobAttempt', async () => {
    await noopProcessor('job-001', deps);
    expect(deps.attemptRepo.create).toHaveBeenCalledTimes(1);
  });

  it('creates the attempt with the correct attemptNumber', async () => {
    (deps.attemptRepo.nextAttemptNumber as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    await noopProcessor('job-001', deps);
    expect(deps.attemptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNumber: 3 }),
    );
  });

  it('creates the attempt with status running', async () => {
    await noopProcessor('job-001', deps);
    expect(deps.attemptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'running' }),
    );
  });

  it('marks the attempt completed', async () => {
    await noopProcessor('job-001', deps);
    const updateCalls = (deps.attemptRepo.update as ReturnType<typeof vi.fn>).mock.calls;
    const completedCall = updateCalls.find(
      (c) => (c[2] as { status?: string }).status === 'completed',
    );
    expect(completedCall).toBeDefined();
  });

  it('marks the job completed', async () => {
    await noopProcessor('job-001', deps);
    const updateCalls = (deps.jobRepo.update as ReturnType<typeof vi.fn>).mock.calls;
    const completedCall = updateCalls.find(
      (c) => (c[2] as { status?: string }).status === 'completed',
    );
    expect(completedCall).toBeDefined();
  });

  it('clears failureReason when completing the job', async () => {
    await noopProcessor('job-001', deps);
    const updateCalls = (deps.jobRepo.update as ReturnType<typeof vi.fn>).mock.calls;
    const completedCall = updateCalls.find(
      (c) => (c[2] as { status?: string }).status === 'completed',
    );
    expect((completedCall?.[2] as { failureReason?: null }).failureReason).toBeNull();
  });

  it('uses the job projectId for scoped repository calls', async () => {
    const job = makeMockJob({ id: 'job-999', projectId: 'proj-xyz' });
    (deps.jobRepo.findByIdGlobal as ReturnType<typeof vi.fn>).mockResolvedValue(job);
    (deps.attemptRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMockAttempt({ projectId: 'proj-xyz' }),
    );

    await noopProcessor('job-999', deps);

    // Scoped update on jobRepo uses projectId from the loaded job
    expect(deps.jobRepo.update).toHaveBeenCalledWith('proj-xyz', 'job-999', expect.any(Object));
  });
});
