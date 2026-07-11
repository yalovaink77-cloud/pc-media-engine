/**
 * Preserve provider Markdown whitespace exactly aside from unsafe/invisible controls.
 * Never collapses spaces, never joins words, never attempts dictionary repair.
 */
export function normalizePreservingMarkdownWhitespace(markdown: string): string {
  return markdown
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/** Confirmed merged tokens from the NeilMed pilot draft (provider-emitted). */
export const CONFIRMED_MERGED_WORD_TOKENS = Object.freeze([
  'simpleformulation',
  'includingits',
  'asa',
  'fluidsand',
  'universallyapplicable',
  'seekinga',
  'cleanlinessduring',
  'professionalpiercer',
  'aftercarefine',
] as const);

/**
 * Strip Markdown regions where product names, URLs, identifiers, and syntax
 * should not trigger merged-word detection.
 */
export function stripProtectedMarkdownRegions(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*\d+\.\s+/gm, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect likely merged-word corruption deterministically.
 * Flags confirmed NeilMed tokens and conservative glue patterns.
 * Does not repair text.
 */
export function detectFormattingCorruption(markdown: string): readonly string[] {
  const findings: string[] = [];
  const haystack = stripProtectedMarkdownRegions(markdown);

  const confirmedHits = CONFIRMED_MERGED_WORD_TOKENS.filter((token) =>
    new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(haystack),
  );
  if (confirmedHits.length > 0) {
    findings.push(`confirmed-merged-tokens:${confirmedHits.length}`);
  }

  // Lowercase body token glued to a capital continuation outside protected regions.
  if (/\b[a-z]{4,}[A-Z][a-z]{2,}\b/.test(haystack)) {
    findings.push('camelcase-merged-token');
  }

  // Explicit product-name glue seen in FAQ lines: AftercareFine
  if (/\bAftercareFine\b/.test(markdown.replace(/```[\s\S]*?```/g, ' '))) {
    findings.push('product-name-space-corruption');
  }

  if (/[a-z]\.[A-Z][a-z]/.test(haystack)) {
    findings.push('missing-space-after-sentence');
  }

  return Object.freeze(findings);
}

/** Verify scrubbing/normalization did not delete inter-word spaces. */
export function assertSpacesPreserved(before: string, after: string): boolean {
  const countSpaces = (value: string): number => (value.match(/ /g) ?? []).length;
  return countSpaces(after) >= countSpaces(before.replace(/\u00A0/g, ''));
}

/** Verify scrubbing did not invent or remove confirmed merged tokens (no silent repair). */
export function assertMergedTokensUnchanged(before: string, after: string): boolean {
  for (const token of CONFIRMED_MERGED_WORD_TOKENS) {
    const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
    if (pattern.test(before) !== pattern.test(after)) {
      return false;
    }
  }
  return true;
}
