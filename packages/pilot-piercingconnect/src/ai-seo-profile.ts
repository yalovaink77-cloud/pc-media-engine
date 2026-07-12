import type {
  AiSeoAnalyzerProfile,
  AiSeoCanonicalEntity,
  AiSeoContradictionPatternPair,
  AiSeoPatternMarker,
} from '@pcme/shared';
import {
  DEFAULT_AI_SEO_CHUNKING_TARGETS,
  DEFAULT_AI_SEO_FAQ_SECTION_ALIASES,
  DEFAULT_AI_SEO_SUMMARY_SECTION_ALIASES,
} from '@pcme/shared';

const CANONICAL_ENTITIES = Object.freeze([
  Object.freeze({
    id: 'neilmed-product',
    canonicalName: 'NeilMed Piercing Aftercare Fine Mist',
    aliases: Object.freeze(['NeilMed', 'Aftercare Fine Mist']),
  }),
  Object.freeze({
    id: 'sterile-saline',
    canonicalName: 'sterile saline',
    aliases: Object.freeze(['sterile saline spray', '0.9% sodium chloride']),
  }),
  Object.freeze({
    id: 'app-guidance',
    canonicalName: 'Association of Professional Piercers',
    aliases: Object.freeze(['APP']),
  }),
] as const satisfies readonly AiSeoCanonicalEntity[]);

const AUDIENCE_QUESTIONS = Object.freeze([
  'Does NeilMed piercing spray prevent keloid formation?',
  'What is the shelf life of NeilMed piercing aftercare mist?',
  'Is NeilMed aftercare FDA approved for piercing wound care?',
  'How does NeilMed aftercare compare with homemade saline mixes?',
] as const);

const PRONOUN_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'third-person',
    pattern: String.raw`\b(?:it|they|them|their|this|these|those)\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'second-person',
    pattern: String.raw`\b(?:you|your)\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const DIRECT_ANSWER_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'product-definition',
    pattern: String.raw`\bNeilMed\b.{0,80}\b(?:sterile saline|aftercare)\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const SOURCE_TRANSPARENCY_MARKERS = Object.freeze([
  Object.freeze({
    id: 'supported-by-evidence',
    pattern: String.raw`\bsupported by evidence\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'app-guidelines',
    pattern: String.raw`\bAPP guidelines?\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const UNCERTAINTY_MARKERS = Object.freeze([
  Object.freeze({
    id: 'may-vary',
    pattern: String.raw`\bmay vary\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'no-guarantee',
    pattern: String.raw`\bno guarantee\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'according-to-manufacturer',
    pattern: String.raw`\baccording to manufacturer\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const MANUFACTURER_CLAIM_MARKERS = Object.freeze([
  Object.freeze({
    id: 'marketed-for',
    pattern: String.raw`\bmarketed for\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const CONTRADICTION_PATTERN_PAIRS = Object.freeze([
  Object.freeze({
    id: 'benefit-vs-limitation',
    positivePattern: String.raw`\bbeneficial\b|\bsafe aftercare\b`,
    negativePattern: String.raw`\bno guarantee\b|\bmay still experience\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoContradictionPatternPair[]);

const FILLER_LANGUAGE_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'advisable',
    pattern: String.raw`\bit is advisable\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'potentially',
    pattern: String.raw`\bpotentially\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'may-find',
    pattern: String.raw`\bmay find\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const CITATION_UNFRIENDLY_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'some-users',
    pattern: String.raw`\bsome users\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'many-people',
    pattern: String.raw`\bmany people\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const VAGUE_CLAIM_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'beneficial',
    pattern: String.raw`\bbeneficial\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'suitable',
    pattern: String.raw`\bsuitable\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const UNSUPPORTED_AUTHORITATIVE_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'supported-by-evidence',
    pattern: String.raw`\bsupported by evidence\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'consistent-with-recommendations',
    pattern: String.raw`\bconsistent with professional (?:aftercare )?recommendations\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

const INDIRECT_FAQ_ANSWER_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'consult-professional',
    pattern: String.raw`\bconsult with a professional\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'not-specified',
    pattern: String.raw`\bnot specified\b`,
    flags: 'i',
  }),
] as const satisfies readonly AiSeoPatternMarker[]);

/** PiercingConnect profile adapter for the generic AI SEO analyzer. */
export function createPiercingConnectAiSeoAnalyzerProfile(): AiSeoAnalyzerProfile {
  return Object.freeze({
    canonicalEntities: CANONICAL_ENTITIES,
    requiredEntityAliases: Object.freeze([
      'NeilMed',
      'sterile saline',
      'Association of Professional Piercers',
    ]),
    audienceQuestions: AUDIENCE_QUESTIONS,
    sectionLengthTargets: Object.freeze({ minWords: 25 }),
    chunkingTargets: DEFAULT_AI_SEO_CHUNKING_TARGETS,
    directAnswerPatterns: DIRECT_ANSWER_PATTERNS,
    sourceTransparencyMarkers: SOURCE_TRANSPARENCY_MARKERS,
    uncertaintyMarkers: UNCERTAINTY_MARKERS,
    manufacturerClaimMarkers: MANUFACTURER_CLAIM_MARKERS,
    contradictionPatternPairs: CONTRADICTION_PATTERN_PAIRS,
    fillerLanguagePatterns: FILLER_LANGUAGE_PATTERNS,
    factualDensityThresholds: Object.freeze({
      minNamedEntityMentionsPerSection: 1,
      minContentWordsPerSection: 35,
    }),
    indirectFaqAnswerPatterns: INDIRECT_FAQ_ANSWER_PATTERNS,
    citationUnfriendlyPatterns: CITATION_UNFRIENDLY_PATTERNS,
    unsupportedAuthoritativePatterns: UNSUPPORTED_AUTHORITATIVE_PATTERNS,
    vagueClaimPatterns: VAGUE_CLAIM_PATTERNS,
    pronounPatterns: PRONOUN_PATTERNS,
    faqSectionAliases: DEFAULT_AI_SEO_FAQ_SECTION_ALIASES,
    summarySectionAliases: DEFAULT_AI_SEO_SUMMARY_SECTION_ALIASES,
  });
}
