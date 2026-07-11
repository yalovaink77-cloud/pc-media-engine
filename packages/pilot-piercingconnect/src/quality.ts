import { type PiercingConnectPilotConfig, PILOT_REQUIRED_SOURCE_PLACEHOLDERS } from './config.js';
import { detectFormattingCorruption } from './formatting.js';
import { findMissingRequiredSections } from './section-markers.js';

export type PilotQualityFindingCode =
  | 'missing-section-markers'
  | 'unresolved-source-placeholders'
  | 'missing-citation-placeholders'
  | 'unsupported-or-overstated-claims'
  | 'formatting-corruption';

export interface PilotQualityFinding {
  readonly code: PilotQualityFindingCode;
  readonly detail: string;
}

const OVERSTATED_CLAIM_PATTERNS: readonly { readonly id: string; readonly pattern: RegExp }[] =
  Object.freeze([
    Object.freeze({
      id: 'safe-claim',
      pattern: /\bseeking safe aftercare\b|\bsafe aftercare solutions?\b|\bsafe for\b/i,
    }),
    Object.freeze({
      id: 'beneficial-claim',
      pattern: /\b(?:may )?find\b[^.!?\n]{0,80}\bbeneficial\b|\bbeneficial\b/i,
    }),
    Object.freeze({
      id: 'supported-by-evidence',
      pattern: /\bsupported by evidence\b/i,
    }),
    Object.freeze({
      id: 'minimizes-risk',
      pattern: /\bminimiz(?:e|es|ing)\s+(?:the\s+)?risk\b|\breduc(?:e|es|ing)\s+(?:the\s+)?risk\b/i,
    }),
    Object.freeze({
      id: 'recommended-for-piercing-types',
      pattern:
        /\brecommended for (?:various|all|any|every)(?:\s+types?\s+of)?\s+piercings?\b|\bsuitable for all(?:\s+types?\s+of)?\s+piercings?\b/i,
    }),
    Object.freeze({
      id: 'consistent-with-professional-recommendations',
      pattern:
        /\bconsistent with professional (?:aftercare )?recommendations\b|\bconsistent with the recommendations from\b/i,
    }),
    Object.freeze({
      id: 'universal-suitability',
      pattern:
        /\b(?:suitable|safe|recommended)\s+for\s+(?:all|every|any)\s+(?:types?\s+of\s+)?piercings?\b|\buniversallyapplicable\b/i,
    }),
    Object.freeze({
      id: 'fixed-usage-frequency',
      pattern:
        /\b(?:\d+\s*[-–to]+\s*\d+|\d+)\s+times?\s+(?:a|per)\s+day\b|\b(?:once|twice)\s+(?:a|per)\s+day\b|\b1-2\s+times\s+daily\b/i,
    }),
    Object.freeze({
      id: 'sensitive-skin-suitability',
      pattern: /\bsuitable\s+for\s+sensitive\s+skin\b|\bideal\s+for\s+sensitive\s+skin\b/i,
    }),
    Object.freeze({
      id: 'reduced-bacterial-risk',
      pattern:
        /\breduc(?:e|es|ing)\s+(?:the\s+)?risk\s+of\s+(?:introducing\s+)?bacteria\b|\bantibacterial\s+protection\b/i,
    }),
    Object.freeze({
      id: 'guaranteed-healing',
      pattern:
        /\bguaranteed?\s+heal(?:ing|s)?\b|\bensures?\s+(?:a\s+)?smooth\s+healing\b|\bwill\s+heal\b/i,
    }),
  ]);

const STRUCTURED_SOURCE_PLACEHOLDER_PATTERN = /\[Source:\s*[^\]]+\]/gi;

export function detectUnsupportedOrOverstatedClaims(
  markdown: string,
): readonly PilotQualityFinding[] {
  const findings: PilotQualityFinding[] = [];
  for (const entry of OVERSTATED_CLAIM_PATTERNS) {
    if (entry.pattern.test(markdown)) {
      findings.push(
        Object.freeze({
          code: 'unsupported-or-overstated-claims',
          detail: entry.id,
        }),
      );
    }
  }
  return Object.freeze(findings);
}

/** @deprecated Use detectUnsupportedOrOverstatedClaims */
export function detectUnsupportedClaims(markdown: string): readonly PilotQualityFinding[] {
  return detectUnsupportedOrOverstatedClaims(markdown);
}

/**
 * Structured [Source: ...] placeholders are useful but not publication-ready.
 * Emit a finding until replaced by resolved source records.
 */
export function detectUnresolvedSourcePlaceholders(
  markdown: string,
  requiredPlaceholders: readonly string[] = PILOT_REQUIRED_SOURCE_PLACEHOLDERS,
): readonly PilotQualityFinding[] {
  const findings: PilotQualityFinding[] = [];
  const placeholders = markdown.match(STRUCTURED_SOURCE_PLACEHOLDER_PATTERN) ?? [];

  if (placeholders.length > 0) {
    findings.push(
      Object.freeze({
        code: 'unresolved-source-placeholders',
        detail: `unresolved-count:${placeholders.length}`,
      }),
    );
  }

  const normalized = markdown.toLowerCase();
  const missingRequired = requiredPlaceholders.filter(
    (placeholder) => !normalized.includes(placeholder.toLowerCase()),
  );
  if (missingRequired.length > 0) {
    findings.push(
      Object.freeze({
        code: 'missing-citation-placeholders',
        detail: `missing-required-placeholders:${missingRequired.length}`,
      }),
    );
  }

  return Object.freeze(findings);
}

/** @deprecated Use detectUnresolvedSourcePlaceholders */
export function detectMissingCitationPlaceholders(
  markdown: string,
  requiredPlaceholders: readonly string[] = PILOT_REQUIRED_SOURCE_PLACEHOLDERS,
): readonly PilotQualityFinding[] {
  return detectUnresolvedSourcePlaceholders(markdown, requiredPlaceholders).filter(
    (finding) => finding.code === 'missing-citation-placeholders',
  );
}

/** Aggregate pilot quality findings without approving or publishing. */
export function analyzePilotDraftQuality(
  markdown: string,
  config: PiercingConnectPilotConfig,
): readonly PilotQualityFinding[] {
  const findings: PilotQualityFinding[] = [];

  const missingSections = findMissingRequiredSections(markdown, config.requiredSections);
  if (missingSections.length > 0) {
    findings.push(
      Object.freeze({
        code: 'missing-section-markers',
        detail: missingSections.join(','),
      }),
    );
  }

  findings.push(...detectUnresolvedSourcePlaceholders(markdown, config.requiredSourcePlaceholders));
  findings.push(...detectUnsupportedOrOverstatedClaims(markdown));

  const formatting = detectFormattingCorruption(markdown);
  if (formatting.length > 0) {
    findings.push(
      Object.freeze({
        code: 'formatting-corruption',
        detail: formatting.join(','),
      }),
    );
  }

  return Object.freeze(findings);
}
