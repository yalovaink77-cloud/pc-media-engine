/** Normalize text for deterministic SEO phrase matching. */
export function normalizeSeoText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check whether normalized haystack contains a normalized phrase. */
export function containsNormalizedPhrase(haystack: string, phrase: string): boolean {
  const normalizedHaystack = normalizeSeoText(haystack);
  const normalizedPhrase = normalizeSeoText(phrase);
  if (!normalizedPhrase) {
    return false;
  }
  return normalizedHaystack.includes(normalizedPhrase);
}

/** Partition keywords into matched and missing sets for coverage analysis. */
export function partitionKeywordCoverage(
  text: string,
  keywords: readonly string[],
): { readonly matched: readonly string[]; readonly missing: readonly string[] } {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of keywords) {
    if (containsNormalizedPhrase(text, keyword)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  return Object.freeze({
    matched: Object.freeze(matched),
    missing: Object.freeze(missing),
  });
}
