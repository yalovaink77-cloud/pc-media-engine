/** Required section definition for editorial structure analysis. */
export interface EditorialRequiredSection {
  readonly id: string;
  readonly headingAliases: readonly string[];
  readonly acceptLeadingH1?: boolean;
  readonly minWordCount?: number;
}

/** Serializable tone pattern used by deterministic editorial tone rules. */
export interface EditorialTonePattern {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
}

/** Thresholds for readability and structure editorial rules. */
export interface EditorialAnalyzerThresholds {
  readonly maxSentenceWordCount: number;
  readonly maxParagraphCharacterCount: number;
  readonly minSectionWordCount: number;
}

/** Profile-driven configuration for the generic editorial analyzer. */
export interface EditorialAnalyzerProfile {
  readonly requiredSections?: readonly EditorialRequiredSection[];
  readonly thresholds?: EditorialAnalyzerThresholds;
  readonly confirmedMergedWordTokens?: readonly string[];
  readonly productNameGluePatterns?: readonly string[];
  readonly promotionalTonePatterns?: readonly EditorialTonePattern[];
  readonly diagnosticTonePatterns?: readonly EditorialTonePattern[];
}

export const DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS = Object.freeze({
  maxSentenceWordCount: 40,
  maxParagraphCharacterCount: 800,
  minSectionWordCount: 20,
} satisfies EditorialAnalyzerThresholds);
