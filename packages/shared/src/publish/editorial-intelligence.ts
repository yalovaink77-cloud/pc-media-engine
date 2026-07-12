import type { EditorialAnalyzerProfile } from './editorial-analyzer.js';
import type { EditorialFinding } from './editorial-finding.js';
import type { FindingConfidence } from './editorial-finding.js';
import type { EvidenceAnalyzerProfile } from './evidence-analyzer.js';

/** Intelligence module identifiers for editorial analysis profiles. */
export type EditorialModuleId = 'editorial' | 'evidence' | 'seo' | 'ai-seo' | 'affiliate';

/** @deprecated Use FindingConfidence from editorial-finding.js */
export type EditorialIntelligenceConfidence = FindingConfidence;

/** @deprecated Use EditorialFinding from editorial-finding.js */
export type EditorialIntelligenceFinding = EditorialFinding;

/** @deprecated Use EditorialFindingLocation from editorial-finding.js */
export type { EditorialFindingLocation } from './editorial-finding.js';

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
  readonly findings: readonly EditorialFinding[];
  readonly scores: EditorialIntelligenceScores;
  readonly publicationReadiness: PublicationReadinessAssessment;
}

/** Generic profile selecting which editorial intelligence modules run. */
export interface EditorialIntelligenceProfile {
  readonly profileId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly enabledModules: readonly EditorialModuleId[];
  readonly editorialAnalyzer?: EditorialAnalyzerProfile;
  readonly evidenceAnalyzer?: EvidenceAnalyzerProfile;
}
