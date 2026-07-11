import { createHash } from 'node:crypto';

import type { EditorialModuleId } from '@pcme/shared';

/** Build a deterministic editorial intelligence report identifier. */
export function buildDeterministicEditorialReportId(input: {
  readonly artifactId: string;
  readonly profileId: string;
  readonly analyzedAt: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

/** Build a deterministic finding identifier within a report. */
export function buildDeterministicEditorialFindingId(input: {
  readonly reportId: string;
  readonly module: EditorialModuleId;
  readonly analyzerId: string;
  readonly code: string;
  readonly identityKey: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}
