/** Required evidence section definition for structure analysis. */
export interface EvidenceRequiredSection {
  readonly id: string;
  readonly headingAliases: readonly string[];
}

/** Serializable pattern marker used by deterministic evidence rules. */
export interface EvidencePatternMarker {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
}

/** Profile-driven configuration for the generic evidence analyzer. */
export interface EvidenceAnalyzerProfile {
  readonly requiredEvidenceSections?: readonly EvidenceRequiredSection[];
  readonly requiredSourcePlaceholders?: readonly string[];
  readonly sourcePlaceholderPattern?: string;
  readonly evidenceNotesSectionAliases?: readonly string[];
  readonly verificationMarkers?: readonly string[];
  readonly manufacturerClaimMarkers?: readonly EvidencePatternMarker[];
  readonly medicalClaimMarkers?: readonly EvidencePatternMarker[];
  readonly unsupportedFactualStatementMarkers?: readonly EvidencePatternMarker[];
  readonly recommendationWithoutEvidenceMarkers?: readonly EvidencePatternMarker[];
}

export const DEFAULT_SOURCE_PLACEHOLDER_PATTERN = String.raw`\[Source:\s*[^\]]+\]`;

export const DEFAULT_EVIDENCE_NOTES_SECTION_ALIASES = Object.freeze([
  'source notes',
  'source-notes',
  'source note',
  'source-note',
  'evidence notes',
  'evidence-notes',
] as const);
