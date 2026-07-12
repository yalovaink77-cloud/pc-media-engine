import type {
  CommercialAnalyzerProfile,
  CommercialPatternMarker,
  EditorialIntelligenceProfile,
} from '@pcme/shared';
import {
  DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES,
} from '@pcme/shared';

const PROMOTIONAL_LANGUAGE_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'safe-claim',
    pattern: String.raw`\bseeking safe aftercare\b|\bsafe aftercare solutions?\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'beneficial-claim',
    pattern: String.raw`\bbeneficial\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'supported-by-evidence',
    pattern: String.raw`\bsupported by evidence\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'consistent-with-professional-recommendations',
    pattern: String.raw`\bconsistent with (?:professional|the recommendations from)\b`,
    flags: 'i',
  }),
] as const satisfies readonly CommercialPatternMarker[]);

const NEUTRALITY_MARKERS = Object.freeze([
  Object.freeze({
    id: 'editorial-independence',
    pattern: String.raw`\beditorial(?:ly)? independent\b|\bindependent review\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'not-sponsored',
    pattern: String.raw`\bnot sponsored\b|\bno sponsorship\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'reader-first',
    pattern: String.raw`\breader(?:s)? first\b|\bfor reader trust\b`,
    flags: 'i',
  }),
] as const satisfies readonly CommercialPatternMarker[]);

const UNSUPPORTED_PURCHASE_RECOMMENDATION_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'recommended-for',
    pattern: String.raw`\brecommended for\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'best-choice',
    pattern: String.raw`\bbest (?:choice|option)\b`,
    flags: 'i',
  }),
] as const satisfies readonly CommercialPatternMarker[]);

/** PiercingConnect profile adapter for the generic commercial analyzer. */
export function createPiercingConnectCommercialAnalyzerProfile(): CommercialAnalyzerProfile {
  return Object.freeze({
    disclosure: Object.freeze({
      sectionAliases: DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES,
      placeholderPatterns: Object.freeze([String.raw`\[Affiliate Disclosure Placeholder\]`]),
      resolvedDisclosureMarkers: Object.freeze([
        'affiliate link',
        'may earn a commission',
        'compensated',
      ]),
      expectedPlacement: 'end',
    }),
    requiredAlternativesSection: Object.freeze({
      id: 'alternatives',
      headingAliases: DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
    }),
    minimumAlternativesCount: 4,
    advantagesSectionAliases: DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES,
    disadvantagesSectionAliases: DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES,
    comparisonSectionAliases: Object.freeze(['comparison', 'how it compares']),
    suitabilitySectionAliases: Object.freeze(['product suitability', 'who is this for']),
    whoShouldAvoidSectionAliases: Object.freeze([
      'who should avoid',
      'who may want to avoid',
      'who should not use',
    ]),
    decisionSupportSectionAliases: Object.freeze(['decision guide', 'buying guide']),
    unsupportedPurchaseRecommendationPatterns: UNSUPPORTED_PURCHASE_RECOMMENDATION_PATTERNS,
    promotionalLanguagePatterns: PROMOTIONAL_LANGUAGE_PATTERNS,
    neutralityMarkers: NEUTRALITY_MARKERS,
    promotionThresholds: Object.freeze({
      maxPromotionalPhraseCount: 1,
      minNeutralityMarkerCount: 1,
    }),
    prosConsThresholds: Object.freeze({
      minDisadvantagesToAdvantagesRatio: 1.6,
      maxCommercialRepetitionCount: 2,
    }),
  });
}

/** Attach PiercingConnect commercial analyzer settings to an intelligence profile. */
export function withPiercingConnectCommercialAnalyzer(
  profile: EditorialIntelligenceProfile,
): EditorialIntelligenceProfile {
  return Object.freeze({
    ...profile,
    commercialAnalyzer: createPiercingConnectCommercialAnalyzerProfile(),
  });
}
