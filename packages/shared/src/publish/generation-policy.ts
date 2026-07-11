/** Policy snapshot captured when content is generated and carried through review and publish. */
export interface GenerationPolicySnapshot {
  readonly safetyConstraints: readonly string[];
  readonly affiliateConstraints: readonly string[];
  readonly citationRequirements: readonly string[];
  readonly blockedFields: readonly string[];
  readonly strictMode: boolean;
  readonly contextComplete: boolean;
  readonly warningCount: number;
}

/** Token/character usage reported by a generation provider response. */
export interface GenerationUsage {
  readonly inputCharacters?: number;
  readonly outputCharacters?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}
