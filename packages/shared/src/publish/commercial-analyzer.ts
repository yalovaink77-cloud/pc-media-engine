/**
 * Commercial Intelligence evaluates publication trust, transparency, and neutrality.
 * It never optimizes for sales, conversions, or affiliate revenue.
 */

/** Serializable pattern marker used by deterministic commercial rules. */
export interface CommercialPatternMarker {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
}

/** Required section definition for commercial structure checks. */
export interface CommercialRequiredSection {
  readonly id: string;
  readonly headingAliases: readonly string[];
  readonly minWordCount?: number;
}

/** Affiliate and commercial disclosure requirements. */
export interface CommercialDisclosureRequirement {
  readonly sectionAliases?: readonly string[];
  readonly resolvedDisclosureMarkers?: readonly string[];
  readonly placeholderPatterns?: readonly string[];
  readonly expectedPlacement?: 'end' | 'beginning';
}

/** Thresholds for promotional and call-to-action balance checks. */
export interface CommercialPromotionThresholds {
  readonly maxPromotionalPhraseCount?: number;
  readonly maxCallToActionCount?: number;
  readonly minNeutralityMarkerCount?: number;
}

/** Thresholds for pros and cons balance checks. */
export interface CommercialProsConsThresholds {
  readonly minDisadvantagesToAdvantagesRatio?: number;
  readonly maxCommercialRepetitionCount?: number;
}

/** Profile-driven configuration for the generic commercial analyzer. */
export interface CommercialAnalyzerProfile {
  readonly disclosure?: CommercialDisclosureRequirement;
  readonly commercialRelationshipMarkers?: readonly CommercialPatternMarker[];
  readonly requiredAlternativesSection?: CommercialRequiredSection;
  readonly minimumAlternativesCount?: number;
  readonly advantagesSectionAliases?: readonly string[];
  readonly disadvantagesSectionAliases?: readonly string[];
  readonly comparisonSectionAliases?: readonly string[];
  readonly suitabilitySectionAliases?: readonly string[];
  readonly whoShouldAvoidSectionAliases?: readonly string[];
  readonly decisionSupportSectionAliases?: readonly string[];
  readonly neutralityMarkers?: readonly CommercialPatternMarker[];
  readonly promotionalLanguagePatterns?: readonly CommercialPatternMarker[];
  readonly unsupportedPurchaseRecommendationPatterns?: readonly CommercialPatternMarker[];
  readonly sponsoredWordingPatterns?: readonly CommercialPatternMarker[];
  readonly callToActionPatterns?: readonly CommercialPatternMarker[];
  readonly priceMentionPatterns?: readonly CommercialPatternMarker[];
  readonly availabilityClaimPatterns?: readonly CommercialPatternMarker[];
  readonly singleProductBiasIndicators?: readonly CommercialPatternMarker[];
  readonly promotionThresholds?: CommercialPromotionThresholds;
  readonly prosConsThresholds?: CommercialProsConsThresholds;
}

export const DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES = Object.freeze([
  'affiliate disclosure',
  'affiliate disclosure placeholder',
  'disclosure',
] as const);

export const DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES = Object.freeze([
  'potential advantages',
  'advantages',
  'pros',
] as const);

export const DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES = Object.freeze([
  'limitations and uncertainties',
  'limitations',
  'disadvantages',
  'cons',
] as const);

export const DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES = Object.freeze([
  'alternatives',
  'alternative products',
] as const);
