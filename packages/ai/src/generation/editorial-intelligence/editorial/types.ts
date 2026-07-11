import type { EditorialFindingInput } from '@pcme/shared';

/** Input for deterministic editorial analysis. */
export interface EditorialAnalysisInput {
  readonly content: string;
  readonly reportId: string;
  readonly artifactId: string;
}

/** Result of deterministic editorial analysis before orchestrator ID assignment. */
export interface EditorialAnalysisResult {
  readonly findings: readonly EditorialFindingInput[];
}
