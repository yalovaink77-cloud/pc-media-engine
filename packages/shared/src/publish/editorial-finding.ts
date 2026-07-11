import type { ContentReviewCheckId } from './content-review.js';

/** Stable identifier for an intelligence finding within a report or review. */
export type EditorialFindingId = string;

/** Severity assigned to an intelligence finding. */
export type FindingSeverity = 'low' | 'medium' | 'high';

/** Confidence assigned to a deterministic or heuristic intelligence finding. */
export type FindingConfidence = 'low' | 'medium' | 'high';

/** Intelligence layer category that produced a finding. */
export type FindingCategory =
  | 'editorial'
  | 'evidence'
  | 'seo'
  | 'ai-seo'
  | 'affiliate'
  | 'knowledge'
  | 'publication'
  | 'performance'
  | 'media'
  | 'business';

/** Machine-stable finding code (kebab-case). */
export type FindingCode = string;

/** Recommended remediation for a finding. */
export interface FindingRecommendation {
  readonly text: string;
}

/** Criteria a reviewer uses to verify a finding is resolved. */
export interface AcceptanceCriteria {
  readonly text: string;
}

/** Location anchor for an intelligence finding. */
export interface EditorialFindingLocation {
  readonly sectionId?: string;
  readonly headingText?: string;
  readonly excerpt?: string;
  readonly lineRange?: { readonly start: number; readonly end: number };
}

/** Generic intelligence finding shared across all intelligence layers. */
export interface EditorialFinding {
  readonly id: EditorialFindingId;
  readonly category: FindingCategory;
  readonly code: FindingCode;
  readonly analyzerId: string;
  readonly checkId: ContentReviewCheckId;
  readonly severity: FindingSeverity;
  readonly confidence: FindingConfidence;
  readonly reason: string;
  readonly recommendation: FindingRecommendation;
  readonly acceptanceCriteria: AcceptanceCriteria;
  readonly location?: EditorialFindingLocation;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

/** Input shape for creating or normalizing a finding before ID assignment. */
export interface EditorialFindingInput {
  readonly id?: EditorialFindingId;
  readonly category: FindingCategory;
  readonly code: FindingCode;
  readonly analyzerId: string;
  readonly checkId: ContentReviewCheckId;
  readonly severity: FindingSeverity;
  readonly confidence: FindingConfidence;
  readonly reason: string;
  readonly recommendation: FindingRecommendation | string;
  readonly acceptanceCriteria: AcceptanceCriteria | string;
  readonly location?: EditorialFindingLocation;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export const FINDING_SEVERITIES = Object.freeze(['low', 'medium', 'high'] as const);

export const FINDING_CONFIDENCES = Object.freeze(['low', 'medium', 'high'] as const);

export const FINDING_CATEGORIES = Object.freeze([
  'editorial',
  'evidence',
  'seo',
  'ai-seo',
  'affiliate',
  'knowledge',
  'publication',
  'performance',
  'media',
  'business',
] as const);

/** Pattern for stable kebab-case finding codes. */
export const FINDING_CODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Pattern for deterministic 32-character finding identifiers. */
export const EDITORIAL_FINDING_ID_PATTERN = /^[a-f0-9]{32}$/;
