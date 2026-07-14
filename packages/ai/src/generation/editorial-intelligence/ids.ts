import { createHash } from 'node:crypto';

/** Build a deterministic editorial intelligence report identifier. */
export function buildDeterministicEditorialReportId(input: {
  readonly artifactId: string;
  readonly profileId: string;
  readonly analyzedAt: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}
