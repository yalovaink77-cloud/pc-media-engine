/**
 * Preserve ordinary spaces, paragraphs, lists, and Markdown line breaks.
 * Only strips invisible/control characters that can look like missing spaces.
 * Never collapses whitespace runs and never joins adjacent words.
 */
export function normalizePreservingMarkdownWhitespace(markdown: string): string {
  return markdown
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * Detect likely word-spacing corruption such as merged tokens:
 * productthat, reviewaims, Itis, AftercareFine.
 */
export function detectFormattingCorruption(markdown: string): readonly string[] {
  const findings: string[] = [];
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');
  // Ignore headings — brand CamelCase like NeilMed is expected there and in titles.
  const withoutHeadings = withoutCode.replace(/^#{1,6}\s+.*$/gm, '');

  const knownMerged = [
    /\bproductthat\b/i,
    /\breviewaims\b/i,
    /\bitis\b/i,
    /\bwoundcare\b/i,
    /\baftercarefine\b/i,
  ];

  for (const pattern of knownMerged) {
    if (pattern.test(withoutHeadings)) {
      findings.push('merged-known-token');
      break;
    }
  }

  // Lowercase word glued to a capitalized continuation (e.g. aftercareFine), not ProperCase brands.
  if (/\b[a-z]{4,}[A-Z][a-z]{2,}\b/.test(withoutHeadings)) {
    findings.push('camelcase-merged-token');
  }

  // Missing space after sentence punctuation before a capital letter.
  if (/[a-z]\.[A-Z][a-z]/.test(withoutHeadings)) {
    findings.push('missing-space-after-sentence');
  }

  return Object.freeze(findings);
}

/** Verify scrubbing/normalization did not delete inter-word spaces. */
export function assertSpacesPreserved(before: string, after: string): boolean {
  const countSpaces = (value: string): number => (value.match(/ /g) ?? []).length;
  // Allow equal or greater space counts (NBSP → space can increase count).
  return countSpaces(after) >= countSpaces(before.replace(/\u00A0/g, ''));
}
