import type { EditorialFindingInput } from '@pcme/shared';

/** Input for deterministic evidence analysis. */
export interface EvidenceAnalysisInput {
  readonly content: string;
  readonly reportId: string;
  readonly artifactId: string;
}

/** Result of deterministic evidence analysis before orchestrator ID assignment. */
export interface EvidenceAnalysisResult {
  readonly findings: readonly EditorialFindingInput[];
}
