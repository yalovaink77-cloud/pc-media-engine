/**
 * AI SEO evaluates structural readiness for machine retrieval and answer synthesis.
 * It does not predict inclusion in ChatGPT, Gemini, Claude, Perplexity, or any search engine.
 * Citation readiness is an advisory structural assessment, not a prediction of citation.
 */

/** Canonical entity definition for AI retrieval coverage checks. */
export interface AiSeoCanonicalEntity {
  readonly id: string;
  readonly canonicalName: string;
  readonly aliases?: readonly string[];
}

/** Serializable pattern marker used by deterministic AI SEO rules. */
export interface AiSeoPatternMarker {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
}

/** Contradiction pattern pair for suitability versus limitation checks. */
export interface AiSeoContradictionPatternPair {
  readonly id: string;
  readonly positivePattern: string;
  readonly negativePattern: string;
  readonly flags?: string;
}

/** Section length targets for chunkability and retrieval checks. */
export interface AiSeoSectionLengthTargets {
  readonly minWords?: number;
  readonly maxWords?: number;
}

/** Chunking targets for machine-retrieval section boundaries. */
export interface AiSeoChunkingTargets {
  readonly maxSectionWords?: number;
  readonly maxParagraphWords?: number;
  readonly minHeadingContextWords?: number;
}

/** Thresholds for factual density heuristics. */
export interface AiSeoFactualDensityThresholds {
  readonly minNamedEntityMentionsPerSection?: number;
  readonly minContentWordsPerSection?: number;
}

/** Profile-driven configuration for the generic AI SEO analyzer. */
export interface AiSeoAnalyzerProfile {
  readonly canonicalEntities?: readonly AiSeoCanonicalEntity[];
  readonly requiredEntityAliases?: readonly string[];
  readonly audienceQuestions?: readonly string[];
  readonly sectionLengthTargets?: AiSeoSectionLengthTargets;
  readonly chunkingTargets?: AiSeoChunkingTargets;
  readonly directAnswerPatterns?: readonly AiSeoPatternMarker[];
  readonly sourceTransparencyMarkers?: readonly AiSeoPatternMarker[];
  readonly uncertaintyMarkers?: readonly AiSeoPatternMarker[];
  readonly manufacturerClaimMarkers?: readonly AiSeoPatternMarker[];
  readonly contradictionPatternPairs?: readonly AiSeoContradictionPatternPair[];
  readonly fillerLanguagePatterns?: readonly AiSeoPatternMarker[];
  readonly factualDensityThresholds?: AiSeoFactualDensityThresholds;
  readonly indirectFaqAnswerPatterns?: readonly AiSeoPatternMarker[];
  readonly citationUnfriendlyPatterns?: readonly AiSeoPatternMarker[];
  readonly unsupportedAuthoritativePatterns?: readonly AiSeoPatternMarker[];
  readonly vagueClaimPatterns?: readonly AiSeoPatternMarker[];
  readonly pronounPatterns?: readonly AiSeoPatternMarker[];
  readonly faqSectionAliases?: readonly string[];
  readonly summarySectionAliases?: readonly string[];
}

export const DEFAULT_AI_SEO_FAQ_SECTION_ALIASES = Object.freeze([
  'faq',
  'frequently asked questions',
] as const);

export const DEFAULT_AI_SEO_SUMMARY_SECTION_ALIASES = Object.freeze([
  'editorial summary',
  'editorial-summary',
] as const);

export const DEFAULT_AI_SEO_CHUNKING_TARGETS = Object.freeze({
  maxSectionWords: 350,
  maxParagraphWords: 120,
  minHeadingContextWords: 8,
} satisfies AiSeoChunkingTargets);
