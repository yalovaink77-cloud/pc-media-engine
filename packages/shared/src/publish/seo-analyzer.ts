/** Required section definition for SEO content-type coverage analysis. */
export interface SeoRequiredSection {
  readonly id: string;
  readonly headingAliases: readonly string[];
  readonly acceptLeadingH1?: boolean;
  readonly minWordCount?: number;
}

/** Length thresholds for title and meta description checks. */
export interface SeoLengthThresholds {
  readonly min: number;
  readonly max: number;
}

/** Serializable pattern marker used by deterministic SEO rules. */
export interface SeoPatternMarker {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
}

/** Descriptor for internal link opportunity detection. */
export interface SeoInternalLinkTargetDescriptor {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
  readonly recommendationHint?: string;
}

/** Thresholds for content completeness SEO checks. */
export interface SeoContentCompletenessThresholds {
  readonly minSectionWordCount?: number;
  readonly minBodyWordCount?: number;
}

/** Profile-driven configuration for the generic SEO analyzer. */
export interface SeoAnalyzerProfile {
  readonly targetKeywords?: readonly string[];
  readonly requiredEntities?: readonly string[];
  readonly searchIntentQuestions?: readonly string[];
  readonly requiredSections?: readonly SeoRequiredSection[];
  readonly titleLengthThresholds?: SeoLengthThresholds;
  readonly metaDescriptionLengthThresholds?: SeoLengthThresholds;
  readonly minimumFaqCount?: number;
  readonly faqSectionAliases?: readonly string[];
  readonly metaDescriptionSectionAliases?: readonly string[];
  readonly internalLinkTargetDescriptors?: readonly SeoInternalLinkTargetDescriptor[];
  readonly externalCitationOpportunityMarkers?: readonly SeoPatternMarker[];
  readonly indirectFaqAnswerPatterns?: readonly SeoPatternMarker[];
  readonly contentCompletenessThresholds?: SeoContentCompletenessThresholds;
}

export const DEFAULT_SEO_TITLE_LENGTH_THRESHOLDS = Object.freeze({
  min: 30,
  max: 60,
} satisfies SeoLengthThresholds);

export const DEFAULT_SEO_META_DESCRIPTION_LENGTH_THRESHOLDS = Object.freeze({
  min: 70,
  max: 155,
} satisfies SeoLengthThresholds);

export const DEFAULT_SEO_FAQ_SECTION_ALIASES = Object.freeze([
  'faq',
  'frequently asked questions',
] as const);

export const DEFAULT_SEO_META_DESCRIPTION_SECTION_ALIASES = Object.freeze([
  'editorial summary',
  'editorial-summary',
] as const);
