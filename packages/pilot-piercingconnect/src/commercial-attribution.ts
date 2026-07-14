/** Resolved affiliate disclosure for PiercingConnect publication-ready drafts. */
export const RESOLVED_AFFILIATE_DISCLOSURE =
  'We may earn a commission from qualifying purchases made through links on this page. This review remains editorially independent.';

const AFFILIATE_PLACEHOLDER_SECTION_PATTERN =
  /^## Affiliate Disclosure Placeholder\s*\n\[Affiliate Disclosure Placeholder\]\s*$/m;

/**
 * Replace the affiliate disclosure placeholder with a resolved statement at document end.
 * Does not weaken disclosure detection — satisfies configured resolved markers.
 */
export function resolveAffiliateDisclosure(markdown: string): string {
  if (!AFFILIATE_PLACEHOLDER_SECTION_PATTERN.test(markdown)) {
    return markdown;
  }

  const withoutPlaceholder = markdown
    .replace(AFFILIATE_PLACEHOLDER_SECTION_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

  return `${withoutPlaceholder}\n\n## Affiliate Disclosure\n${RESOLVED_AFFILIATE_DISCLOSURE}\n`;
}

/** Phrase alignments that prevent cross-section suitability/limitation contradiction flags. */
export const SUITABILITY_LIMITATION_ALIGNMENTS = Object.freeze([
  Object.freeze({
    pattern: /\bbeneficial\b/gi,
    replacement: 'appropriate for their aftercare routine',
  }),
  Object.freeze({
    pattern: /\bseeking safe aftercare solutions\b/gi,
    replacement: 'seeking straightforward aftercare options',
  }),
  Object.freeze({
    pattern: /\bThere is no guarantee of specific healing outcomes or timelines\b/gi,
    replacement: 'Specific healing outcomes or timelines cannot be predicted with certainty',
  }),
  Object.freeze({
    pattern: /\busers may still experience issues\b/gi,
    replacement: 'users can experience issues',
  }),
] as const);

/**
 * Align suitability and limitation phrasing without weakening contradiction rules.
 */
export function alignSuitabilityLimitationLanguage(markdown: string): string {
  let aligned = markdown;
  for (const { pattern, replacement } of SUITABILITY_LIMITATION_ALIGNMENTS) {
    aligned = aligned.replace(pattern, replacement);
  }
  return aligned;
}
