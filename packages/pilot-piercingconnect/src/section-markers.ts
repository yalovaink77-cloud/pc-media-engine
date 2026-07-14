import type { PilotRequiredSection } from './config.js';

export interface MarkdownHeading {
  readonly level: number;
  readonly text: string;
  readonly normalizedText: string;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*$/gm;

function normalizeHeadingText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract ATX Markdown headings deterministically. */
export function extractMarkdownHeadings(markdown: string): readonly MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  for (const match of markdown.matchAll(HEADING_PATTERN)) {
    const level = match[1]?.length ?? 0;
    const text = (match[2] ?? '').trim();
    if (!text) {
      continue;
    }
    headings.push(
      Object.freeze({
        level,
        text,
        normalizedText: normalizeHeadingText(text),
      }),
    );
  }
  return Object.freeze(headings);
}

function sectionMatched(
  section: PilotRequiredSection,
  headings: readonly MarkdownHeading[],
): boolean {
  const aliases = new Set(
    section.headingAliases.map((alias) => normalizeHeadingText(alias)).filter(Boolean),
  );

  for (const heading of headings) {
    if (aliases.has(heading.normalizedText)) {
      return true;
    }
  }

  if ('acceptLeadingH1' in section && section.acceptLeadingH1) {
    const leadingH1 = headings.find((heading) => heading.level === 1);
    if (leadingH1 && leadingH1.normalizedText.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Return missing required section ids using heading detection.
 * Does not use raw body substring matching (avoids false positives/negatives).
 */
export function findMissingRequiredSections(
  markdown: string,
  requiredSections: readonly PilotRequiredSection[],
): readonly string[] {
  const headings = extractMarkdownHeadings(markdown);
  return Object.freeze(
    requiredSections
      .filter((section) => !sectionMatched(section, headings))
      .map((section) => section.id),
  );
}
