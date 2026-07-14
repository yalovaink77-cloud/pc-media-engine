import type { EditorialFindingInput } from '@pcme/shared';

/** Input for deterministic AI SEO analysis. */
export interface AiSeoAnalysisInput {
  readonly content: string;
  readonly reportId: string;
  readonly artifactId: string;
}

/** Result of deterministic AI SEO analysis before orchestrator ID assignment. */
export interface AiSeoAnalysisResult {
  readonly findings: readonly EditorialFindingInput[];
}
