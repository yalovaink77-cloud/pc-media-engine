/**
 * Map BullMQ jobs to read-only publishing job DTOs — Sprint 38.
 */

import type { Job } from 'bullmq';

import type {
  JobDetail,
  JobErrorInfo,
  JobListItem,
  JobPayloadSummary,
  JobRetryAttempt,
} from './job-types.js';

type RawPayload = Record<string, unknown>;

export function sanitizePayload(data: unknown): JobPayloadSummary {
  const obj = data !== null && typeof data === 'object' ? (data as RawPayload) : {};
  return {
    title: typeof obj['title'] === 'string' ? obj['title'] : '',
    slug: typeof obj['slug'] === 'string' ? obj['slug'] : '',
    organizationId: typeof obj['organizationId'] === 'string' ? obj['organizationId'] : undefined,
    projectId: typeof obj['projectId'] === 'string' ? obj['projectId'] : undefined,
    assetId: typeof obj['assetId'] === 'string' ? obj['assetId'] : undefined,
    processingJobId:
      typeof obj['processingJobId'] === 'string' ? obj['processingJobId'] : undefined,
    scheduledFor: typeof obj['scheduledFor'] === 'string' ? obj['scheduledFor'] : undefined,
    mediaMimeType: typeof obj['mediaMimeType'] === 'string' ? obj['mediaMimeType'] : undefined,
    mediaFilename: typeof obj['mediaFilename'] === 'string' ? obj['mediaFilename'] : undefined,
    hasMedia: Boolean(obj['mediaBuffer'] ?? obj['mediaData']),
    publisherId: typeof obj['publisherId'] === 'string' ? obj['publisherId'] : undefined,
  };
}

function toIso(ms: number | undefined): string | undefined {
  if (ms === undefined || ms <= 0) return undefined;
  return new Date(ms).toISOString();
}

function buildRetryHistory(
  attemptsMade: number,
  failedReason?: string,
  stacktrace?: string[],
): JobRetryAttempt[] {
  if (attemptsMade <= 0 && !failedReason) return [];

  const history: JobRetryAttempt[] = [];
  const traces = stacktrace ?? [];

  if (attemptsMade <= 1) {
    if (failedReason) {
      history.push({ attempt: 1, error: failedReason });
    }
    return history;
  }

  for (let i = 1; i <= attemptsMade; i++) {
    const trace = traces[i - 1] ?? traces[traces.length - 1];
    const error = i === attemptsMade ? (failedReason ?? trace) : trace;
    if (error) history.push({ attempt: i, error });
  }

  if (history.length === 0 && failedReason) {
    history.push({ attempt: attemptsMade, error: failedReason });
  }

  return history;
}

function buildErrorInfo(failedReason?: string, stacktrace?: string[]): JobErrorInfo | undefined {
  if (!failedReason && (!stacktrace || stacktrace.length === 0)) return undefined;
  return {
    message: failedReason,
    stacktrace: stacktrace?.length ? stacktrace : undefined,
  };
}

function resolveJobPublisher(data: unknown, fallback: string): string {
  const obj = data !== null && typeof data === 'object' ? (data as RawPayload) : {};
  const publisherId = obj['publisherId'];
  return typeof publisherId === 'string' && publisherId.trim() ? publisherId.trim() : fallback;
}

export async function mapJobToListItem(
  job: Job,
  state: string,
  publisherFallback: string,
): Promise<JobListItem> {
  const payload = sanitizePayload(job.data);
  const publisher = resolveJobPublisher(job.data, publisherFallback);
  const maxAttempts = job.opts.attempts ?? 1;
  const createdAt = toIso(job.timestamp) ?? new Date(0).toISOString();
  const updatedAt = toIso(job.finishedOn ?? job.processedOn ?? job.timestamp);

  return {
    id: job.id ?? '',
    name: job.name,
    status: state,
    publisher,
    projectId: payload.projectId,
    assetId: payload.assetId,
    title: payload.title,
    slug: payload.slug,
    retryCount: job.attemptsMade,
    maxAttempts,
    createdAt,
    updatedAt,
    scheduledFor: payload.scheduledFor,
  };
}

export async function mapJobToDetail(
  job: Job,
  state: string,
  publisherFallback: string,
  queuePaused: boolean,
): Promise<JobDetail> {
  const base = await mapJobToListItem(job, state, publisherFallback);
  const payload = sanitizePayload(job.data);
  const scheduledTime =
    payload.scheduledFor ??
    (job.delay && job.timestamp ? toIso(job.timestamp + job.delay) : undefined);

  return {
    ...base,
    payload,
    queueState: state,
    scheduledTime,
    processedAt: toIso(job.processedOn),
    finishedAt: toIso(job.finishedOn),
    delayMs: job.delay || undefined,
    error: buildErrorInfo(job.failedReason, job.stacktrace ?? undefined),
    retryHistory: buildRetryHistory(
      job.attemptsMade,
      job.failedReason,
      job.stacktrace ?? undefined,
    ),
    queuePaused,
  };
}
