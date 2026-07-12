import type {
  EditorialIntelligenceProfile,
  SeoAnalyzerProfile,
  SeoInternalLinkTargetDescriptor,
  SeoPatternMarker,
} from '@pcme/shared';
import {
  DEFAULT_SEO_FAQ_SECTION_ALIASES,
  DEFAULT_SEO_META_DESCRIPTION_LENGTH_THRESHOLDS,
  DEFAULT_SEO_META_DESCRIPTION_SECTION_ALIASES,
  DEFAULT_SEO_TITLE_LENGTH_THRESHOLDS,
} from '@pcme/shared';

import { type PiercingConnectPilotConfig, PILOT_REQUIRED_SECTIONS } from './config.js';
import { createPiercingConnectEditorialAnalyzerProfile } from './editorial-profile.js';
import { createPiercingConnectEvidenceAnalyzerProfile } from './evidence-profile.js';

const TARGET_KEYWORDS = Object.freeze([
  'saline spray',
  'piercing aftercare spray',
  'sterile saline mist',
] as const);

const REQUIRED_ENTITIES = Object.freeze(['NeilMed', 'sterile saline', 'sodium chloride'] as const);

const SEARCH_INTENT_QUESTIONS = Object.freeze([
  'Does NeilMed piercing spray prevent keloid formation?',
  'What is the shelf life of NeilMed piercing aftercare mist?',
  'Is NeilMed aftercare FDA approved for piercing wound care?',
] as const);

const INTERNAL_LINK_TARGETS = Object.freeze([
  Object.freeze({
    id: 'professional-piercer',
    pattern: String.raw`\bprofessional piercer\b`,
    flags: 'i',
    recommendationHint:
      'Link to the site aftercare guide or professional guidance hub where piercers are mentioned.',
  }),
  Object.freeze({
    id: 'aftercare-alternatives',
    pattern: String.raw`\baftercare products?\b`,
    flags: 'i',
    recommendationHint: 'Link to related aftercare comparison or category pages.',
  }),
] as const satisfies readonly SeoInternalLinkTargetDescriptor[]);

const EXTERNAL_CITATION_MARKERS = Object.freeze([
  Object.freeze({
    id: 'app-guidelines',
    pattern: String.raw`\bAPP guidelines?\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'supported-by-evidence',
    pattern: String.raw`\bsupported by evidence\b`,
    flags: 'i',
  }),
] as const satisfies readonly SeoPatternMarker[]);

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
  Object.freeze({
    id: 'may-vary',
    pattern: String.raw`\bmay vary\b`,
    flags: 'i',
  }),
] as const satisfies readonly SeoPatternMarker[]);

/** PiercingConnect profile adapter for the generic SEO analyzer. */
export function createPiercingConnectSeoAnalyzerProfile(
  config: Pick<PiercingConnectPilotConfig, 'requiredSections'> = {
    requiredSections: PILOT_REQUIRED_SECTIONS,
  },
): SeoAnalyzerProfile {
  return Object.freeze({
    targetKeywords: TARGET_KEYWORDS,
    requiredEntities: REQUIRED_ENTITIES,
    searchIntentQuestions: SEARCH_INTENT_QUESTIONS,
    requiredSections: Object.freeze(
      config.requiredSections.map((section) =>
        Object.freeze({
          id: section.id,
          headingAliases: section.headingAliases,
          acceptLeadingH1: 'acceptLeadingH1' in section ? section.acceptLeadingH1 : undefined,
        }),
      ),
    ),
    titleLengthThresholds: DEFAULT_SEO_TITLE_LENGTH_THRESHOLDS,
    metaDescriptionLengthThresholds: DEFAULT_SEO_META_DESCRIPTION_LENGTH_THRESHOLDS,
    minimumFaqCount: 4,
    faqSectionAliases: DEFAULT_SEO_FAQ_SECTION_ALIASES,
    metaDescriptionSectionAliases: DEFAULT_SEO_META_DESCRIPTION_SECTION_ALIASES,
    internalLinkTargetDescriptors: INTERNAL_LINK_TARGETS,
    externalCitationOpportunityMarkers: EXTERNAL_CITATION_MARKERS,
    indirectFaqAnswerPatterns: INDIRECT_FAQ_ANSWER_PATTERNS,
    contentCompletenessThresholds: Object.freeze({
      minSectionWordCount: 20,
    }),
  });
}

/** Attach PiercingConnect SEO analyzer settings to an intelligence profile. */
export function withPiercingConnectSeoAnalyzer(
  profile: EditorialIntelligenceProfile,
  config?: Pick<PiercingConnectPilotConfig, 'requiredSections'>,
): EditorialIntelligenceProfile {
  return Object.freeze({
    ...profile,
    seoAnalyzer: createPiercingConnectSeoAnalyzerProfile(config),
  });
}

/** Attach PiercingConnect editorial, evidence, and SEO analyzer settings. */
export function withPiercingConnectIntelligenceAnalyzers(
  profile: EditorialIntelligenceProfile,
  config?: Pick<PiercingConnectPilotConfig, 'requiredSections' | 'requiredSourcePlaceholders'>,
): EditorialIntelligenceProfile {
  return withPiercingConnectSeoAnalyzer(
    Object.freeze({
      ...profile,
      editorialAnalyzer: createPiercingConnectEditorialAnalyzerProfile({
        requiredSections: config?.requiredSections ?? PILOT_REQUIRED_SECTIONS,
      }),
      evidenceAnalyzer: createPiercingConnectEvidenceAnalyzerProfile(config),
    }),
    config,
  );
}
