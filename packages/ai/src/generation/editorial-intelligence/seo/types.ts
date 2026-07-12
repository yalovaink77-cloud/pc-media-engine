import type { EditorialFindingInput } from '@pcme/shared';

/** Input for deterministic SEO analysis. */
export interface SeoAnalysisInput {
  readonly content: string;
  readonly reportId: string;
  readonly artifactId: string;
}

/** Result of deterministic SEO analysis before orchestrator ID assignment. */
export interface SeoAnalysisResult {
  readonly findings: readonly EditorialFindingInput[];
}
