import type { EditorialFindingInput } from '@pcme/shared';

/** Input for deterministic commercial analysis. */
export interface CommercialAnalysisInput {
  readonly content: string;
  readonly reportId: string;
  readonly artifactId: string;
}

/** Result of deterministic commercial analysis before orchestrator ID assignment. */
export interface CommercialAnalysisResult {
  readonly findings: readonly EditorialFindingInput[];
}
