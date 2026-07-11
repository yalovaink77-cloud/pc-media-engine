import type { ContentReviewCheckId, ContentReviewSeverity } from './content-review.js';

/** Intelligence module identifiers for editorial analysis. */
export type EditorialModuleId = 'editorial' | 'evidence' | 'seo' | 'ai-seo' | 'affiliate';

/** Confidence assigned to a deterministic or heuristic editorial finding. */
export type EditorialIntelligenceConfidence = 'low' | 'medium' | 'high';

/** Location anchor for an editorial intelligence finding. */
export interface EditorialFindingLocation {
  readonly sectionId?: string;
  readonly headingText?: string;
  readonly excerpt?: string;
  readonly lineRange?: { readonly start: number; readonly end: number };
}

/** Structured finding raised by an editorial intelligence module. */
export interface EditorialIntelligenceFinding {
  readonly findingId: string;
  readonly module: EditorialModuleId;
  readonly analyzerId: string;
  readonly code: string;
  readonly checkId: ContentReviewCheckId;
  readonly severity: ContentReviewSeverity;
  readonly confidence: EditorialIntelligenceConfidence;
  readonly reason: string;
  readonly recommendation: string;
  readonly acceptanceCriteria: string;
  readonly location?: EditorialFindingLocation;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

/** Per-module summary within an editorial intelligence report. */
export interface EditorialModuleSummary {
  readonly module: EditorialModuleId;
  readonly findingCount: number;
  readonly blockingFindingCount: number;
}

/** Advisory publication readiness assessment — never auto-approves content. */
export interface PublicationReadinessAssessment {
  readonly status: 'not-ready' | 'needs-revision' | 'ready-for-human-review';
  readonly blockingFindingCount: number;
  readonly advisoryFindingCount: number;
  readonly note: string;
}

/** Aggregate scoring metadata for an editorial intelligence report. */
export interface EditorialIntelligenceScores {
  readonly totalFindings: number;
  readonly blockingFindings: number;
  readonly advisoryFindings: number;
}

/** Deterministic editorial intelligence report for a generated artifact. */
export interface EditorialIntelligenceReport {
  readonly reportId: string;
  readonly artifactId: string;
  readonly profileId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly analyzedAt: string;
  readonly moduleSummaries: readonly EditorialModuleSummary[];
  readonly findings: readonly EditorialIntelligenceFinding[];
  readonly scores: EditorialIntelligenceScores;
  readonly publicationReadiness: PublicationReadinessAssessment;
}

/** Generic profile selecting which editorial intelligence modules run. */
export interface EditorialIntelligenceProfile {
  readonly profileId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly enabledModules: readonly EditorialModuleId[];
}
