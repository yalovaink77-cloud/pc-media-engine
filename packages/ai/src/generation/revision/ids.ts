import { createHash } from 'node:crypto';

export function buildDeterministicRevisionRequestId(input: {
  reviewId: string;
  reportId: string;
  createdAt: string;
  selectedFindingIds?: readonly string[];
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

export function buildDeterministicRevisionJobId(input: {
  requestId: string;
  sourceId: string;
  contentType: string;
  revisionRequestId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

export function buildDeterministicRevisionArtifactId(input: {
  jobId: string;
  requestId: string;
  providerId: string;
  revisionRequestId: string;
  revisionNumber: number;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

export function buildDeterministicRevisionItemId(input: {
  revisionRequestId: string;
  findingId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}
