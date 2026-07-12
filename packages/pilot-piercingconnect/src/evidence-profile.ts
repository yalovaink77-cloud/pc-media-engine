import type {
  EditorialIntelligenceProfile,
  EvidenceAnalyzerProfile,
  EvidencePatternMarker,
} from '@pcme/shared';
import {
  DEFAULT_EVIDENCE_NOTES_SECTION_ALIASES,
  DEFAULT_SOURCE_PLACEHOLDER_PATTERN,
} from '@pcme/shared';

import {
  type PiercingConnectPilotConfig,
  PILOT_REQUIRED_SECTIONS,
  PILOT_REQUIRED_SOURCE_PLACEHOLDERS,
} from './config.js';
import { createPiercingConnectEditorialAnalyzerProfile } from './editorial-profile.js';

const EVIDENCE_SECTION_IDS = Object.freeze([
  'source-notes',
  'evidence-and-guideline-alignment',
  'verified-formula',
] as const);

const MANUFACTURER_CLAIM_MARKERS = Object.freeze([
  Object.freeze({
    id: 'marketed-for',
    pattern: String.raw`\bmarketed for\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'manufacturer-positioning',
    pattern: String.raw`\b(?:positioned|marketed) by the manufacturer\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'manufacturer-materials',
    pattern: String.raw`\baccording to manufacturer materials\b`,
    flags: 'i',
  }),
] as const satisfies readonly EvidencePatternMarker[]);

const MEDICAL_CLAIM_MARKERS = Object.freeze([
  Object.freeze({
    id: 'infection-indicator',
    pattern: String.raw`\bmay indicate infection\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'wound-care-guidance',
    pattern: String.raw`\bwound (?:care|washing)\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'healing-process',
    pattern: String.raw`\bhealing process\b`,
    flags: 'i',
  }),
] as const satisfies readonly EvidencePatternMarker[]);

const UNSUPPORTED_FACTUAL_STATEMENT_MARKERS = Object.freeze([
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
] as const satisfies readonly EvidencePatternMarker[]);

const RECOMMENDATION_WITHOUT_EVIDENCE_MARKERS = Object.freeze([
  Object.freeze({
    id: 'recommended-for',
    pattern: String.raw`\brecommended for\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'supported-by-evidence-inline',
    pattern: String.raw`\bsupported by evidence\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'beneficial-claim',
    pattern: String.raw`\bbeneficial\b`,
    flags: 'i',
  }),
] as const satisfies readonly EvidencePatternMarker[]);

const VERIFICATION_MARKERS = Object.freeze([
  'human-verified',
  'resolved source record',
  'verified record',
  'verified structured fact',
] as const);

/** PiercingConnect profile adapter for the generic evidence analyzer. */
export function createPiercingConnectEvidenceAnalyzerProfile(
  config: Pick<PiercingConnectPilotConfig, 'requiredSections' | 'requiredSourcePlaceholders'> = {
    requiredSections: PILOT_REQUIRED_SECTIONS,
    requiredSourcePlaceholders: PILOT_REQUIRED_SOURCE_PLACEHOLDERS,
  },
): EvidenceAnalyzerProfile {
  const requiredEvidenceSections = config.requiredSections
    .filter((section) =>
      EVIDENCE_SECTION_IDS.includes(section.id as (typeof EVIDENCE_SECTION_IDS)[number]),
    )
    .map((section) =>
      Object.freeze({
        id: section.id,
        headingAliases: section.headingAliases,
      }),
    );

  return Object.freeze({
    requiredEvidenceSections,
    requiredSourcePlaceholders: config.requiredSourcePlaceholders,
    sourcePlaceholderPattern: DEFAULT_SOURCE_PLACEHOLDER_PATTERN,
    evidenceNotesSectionAliases: DEFAULT_EVIDENCE_NOTES_SECTION_ALIASES,
    verificationMarkers: VERIFICATION_MARKERS,
    manufacturerClaimMarkers: MANUFACTURER_CLAIM_MARKERS,
    medicalClaimMarkers: MEDICAL_CLAIM_MARKERS,
    unsupportedFactualStatementMarkers: UNSUPPORTED_FACTUAL_STATEMENT_MARKERS,
    recommendationWithoutEvidenceMarkers: RECOMMENDATION_WITHOUT_EVIDENCE_MARKERS,
  });
}

/** Attach PiercingConnect evidence analyzer settings to an intelligence profile. */
export function withPiercingConnectEvidenceAnalyzer(
  profile: EditorialIntelligenceProfile,
  config?: Pick<PiercingConnectPilotConfig, 'requiredSections' | 'requiredSourcePlaceholders'>,
): EditorialIntelligenceProfile {
  return Object.freeze({
    ...profile,
    evidenceAnalyzer: createPiercingConnectEvidenceAnalyzerProfile(config),
  });
}

/** Attach both PiercingConnect editorial and evidence analyzer settings. */
export function withPiercingConnectIntelligenceAnalyzers(
  profile: EditorialIntelligenceProfile,
  config?: Pick<PiercingConnectPilotConfig, 'requiredSections' | 'requiredSourcePlaceholders'>,
): EditorialIntelligenceProfile {
  return withPiercingConnectEvidenceAnalyzer(
    Object.freeze({
      ...profile,
      editorialAnalyzer: createPiercingConnectEditorialAnalyzerProfile({
        requiredSections: config?.requiredSections ?? PILOT_REQUIRED_SECTIONS,
      }),
    }),
    config,
  );
}
