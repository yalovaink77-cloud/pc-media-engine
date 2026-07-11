import { type PiercingConnectPilotConfig, PILOT_REQUIRED_SOURCE_PLACEHOLDERS } from './config.js';
import { detectFormattingCorruption } from './formatting.js';
import { findMissingRequiredSections } from './section-markers.js';

export type PilotQualityFindingCode =
  | 'missing-section-markers'
  | 'missing-citation-placeholders'
  | 'unsupported-claim'
  | 'formatting-corruption';

export interface PilotQualityFinding {
  readonly code: PilotQualityFindingCode;
  readonly detail: string;
}

const UNSUPPORTED_CLAIM_PATTERNS: readonly { readonly id: string; readonly pattern: RegExp }[] =
  Object.freeze([
    Object.freeze({
      id: 'universal-suitability',
      pattern:
        /\b(?:suitable|safe|recommended)\s+for\s+(?:all|every|any)\s+(?:types?\s+of\s+)?piercings?\b/i,
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

const STRUCTURED_SOURCE_PATTERN = /\[Source:\s*[^\]]+\]/i;

export function detectUnsupportedClaims(markdown: string): readonly PilotQualityFinding[] {
  const findings: PilotQualityFinding[] = [];
  for (const entry of UNSUPPORTED_CLAIM_PATTERNS) {
    if (entry.pattern.test(markdown)) {
      findings.push(
        Object.freeze({
          code: 'unsupported-claim',
          detail: entry.id,
        }),
      );
    }
  }
  return Object.freeze(findings);
}

export function detectMissingCitationPlaceholders(
  markdown: string,
  requiredPlaceholders: readonly string[] = PILOT_REQUIRED_SOURCE_PLACEHOLDERS,
): readonly PilotQualityFinding[] {
  const normalized = markdown.toLowerCase();
  const missing = requiredPlaceholders.filter(
    (placeholder) => !normalized.includes(placeholder.toLowerCase()),
  );

  if (missing.length === 0) {
    return Object.freeze([]);
  }

  // Also accept any structured [Source: ...] if all required exact strings are absent
  // but we still want explicit required placeholders for pilot citation readiness.
  const hasAnyStructured = STRUCTURED_SOURCE_PATTERN.test(markdown);
  return Object.freeze([
    Object.freeze({
      code: 'missing-citation-placeholders' as const,
      detail: hasAnyStructured
        ? `missing-required-placeholders:${missing.length}`
        : `missing-structured-source-placeholders:${missing.length}`,
    }),
  ]);
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

  findings.push(...detectMissingCitationPlaceholders(markdown, config.requiredSourcePlaceholders));
  findings.push(...detectUnsupportedClaims(markdown));

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
