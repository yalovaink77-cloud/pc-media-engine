/**
 * Publishing job DTOs — Sprint 38.
 *
 * Read-only views of BullMQ publishing queue jobs.
 * Media blobs are never included in API responses.
 */

export type JobPayloadSummary = {
  title: string;
  slug: string;
  organizationId?: string;
  projectId?: string;
  assetId?: string;
  processingJobId?: string;
  scheduledFor?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  hasMedia: boolean;
};

export type JobListItem = {
  id: string;
  name: string;
  status: string;
  publisher: string;
  projectId?: string;
  assetId?: string;
  title: string;
  slug: string;
  retryCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt?: string;
  scheduledFor?: string;
};

export type JobRetryAttempt = {
  attempt: number;
  error?: string;
};

export type JobErrorInfo = {
  message?: string;
  stacktrace?: string[];
};

export type JobDetail = JobListItem & {
  payload: JobPayloadSummary;
  queueState: string;
  scheduledTime?: string;
  processedAt?: string;
  finishedAt?: string;
  delayMs?: number;
  error?: JobErrorInfo;
  retryHistory: JobRetryAttempt[];
  queuePaused: boolean;
};

export type JobListQuery = {
  status?: string;
  publisher?: string;
  projectId?: string;
  assetId?: string;
  limit?: number;
  offset?: number;
};

export type JobListResult = {
  jobs: JobListItem[];
  total: number;
  limit: number;
  offset: number;
};

export const JOB_STATUSES = ['waiting', 'active', 'delayed', 'failed', 'completed'] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export const DEFAULT_JOB_LIMIT = 50;
export const MAX_JOB_LIMIT = 200;
export const MAX_JOBS_FETCH = 2000;
