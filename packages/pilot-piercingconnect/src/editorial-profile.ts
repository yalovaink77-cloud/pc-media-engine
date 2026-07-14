import type {
  EditorialAnalyzerProfile,
  EditorialIntelligenceProfile,
  EditorialTonePattern,
} from '@pcme/shared';
import { DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS } from '@pcme/shared';

import { type PiercingConnectPilotConfig, PILOT_REQUIRED_SECTIONS } from './config.js';
import { CONFIRMED_MERGED_WORD_TOKENS } from './formatting.js';

const PROMOTIONAL_TONE_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'safe-claim',
    pattern: String.raw`\bseeking safe aftercare\b|\bsafe aftercare solutions?\b|\bsafe for\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'beneficial-claim',
    pattern: String.raw`\b(?:may )?find\b[^.!?\n]{0,80}\bbeneficial\b|\bbeneficial\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'supported-by-evidence',
    pattern: String.raw`\bsupported by evidence\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'minimizes-risk',
    pattern: String.raw`\bminimiz(?:e|es|ing)\s+(?:the\s+)?risk\b|\breduc(?:e|es|ing)\s+(?:the\s+)?risk\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'consistent-with-professional-recommendations',
    pattern: String.raw`\bconsistent with professional (?:aftercare )?recommendations\b|\bconsistent with the recommendations from\b`,
    flags: 'i',
  }),
] as const satisfies readonly EditorialTonePattern[]);

const DIAGNOSTIC_TONE_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'guaranteed-healing',
    pattern: String.raw`\bguaranteed?\s+heal(?:ing|s)?\b|\bensures?\s+(?:a\s+)?smooth\s+healing\b|\bwill\s+heal\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'infection-diagnosis',
    pattern: String.raw`\b(?:indicate|indicates|sign of)\s+infection\b|\bdiagnos(?:e|is|ing)\b`,
    flags: 'i',
  }),
  Object.freeze({
    id: 'urgent-medical',
    pattern: String.raw`\bimmediately (?:see|consult)\b|\burgent(?:ly)?\s+(?:seek|contact)\b`,
    flags: 'i',
  }),
] as const satisfies readonly EditorialTonePattern[]);

/** PiercingConnect profile adapter for the generic editorial analyzer. */
export function createPiercingConnectEditorialAnalyzerProfile(
  config: Pick<PiercingConnectPilotConfig, 'requiredSections'> = {
    requiredSections: PILOT_REQUIRED_SECTIONS,
  },
): EditorialAnalyzerProfile {
  return Object.freeze({
    requiredSections: Object.freeze(
      config.requiredSections.map((section) =>
        Object.freeze({
          id: section.id,
          headingAliases: section.headingAliases,
          acceptLeadingH1: 'acceptLeadingH1' in section ? section.acceptLeadingH1 : undefined,
        }),
      ),
    ),
    thresholds: DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS,
    confirmedMergedWordTokens: CONFIRMED_MERGED_WORD_TOKENS,
    productNameGluePatterns: Object.freeze([String.raw`\bAftercareFine\b`]),
    promotionalTonePatterns: PROMOTIONAL_TONE_PATTERNS,
    diagnosticTonePatterns: DIAGNOSTIC_TONE_PATTERNS,
  });
}

/** Attach PiercingConnect editorial analyzer settings to an intelligence profile. */
export function withPiercingConnectEditorialAnalyzer(
  profile: EditorialIntelligenceProfile,
  config?: Pick<PiercingConnectPilotConfig, 'requiredSections'>,
): EditorialIntelligenceProfile {
  return Object.freeze({
    ...profile,
    editorialAnalyzer: createPiercingConnectEditorialAnalyzerProfile(config),
  });
}
