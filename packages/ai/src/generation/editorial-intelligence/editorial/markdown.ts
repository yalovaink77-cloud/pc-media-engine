/** Markdown heading extracted from ATX heading lines. */
export interface MarkdownHeading {
  readonly level: number;
  readonly text: string;
  readonly normalizedText: string;
  readonly lineNumber: number;
}

/** Markdown section bounded by headings. */
export interface MarkdownSection {
  readonly id: string;
  readonly heading: MarkdownHeading | null;
  readonly body: string;
  readonly startLine: number;
  readonly endLine: number;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*$/;
const VALID_HEADING_PATTERN = /^#{1,6}\s+\S/;

export function normalizeHeadingText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract ATX Markdown headings deterministically. */
export function extractMarkdownHeadings(markdown: string): readonly MarkdownHeading[] {
  const lines = markdown.split('\n');
  const headings: MarkdownHeading[] = [];

  for (const [index, line] of lines.entries()) {
    const match = line.match(HEADING_PATTERN);
    if (!match) {
      continue;
    }

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
        lineNumber: index + 1,
      }),
    );
  }

  return Object.freeze(headings);
}

/** Split markdown into sections using heading boundaries. */
export function extractMarkdownSections(markdown: string): readonly MarkdownSection[] {
  const lines = markdown.split('\n');
  const headings = extractMarkdownHeadings(markdown);
  if (headings.length === 0) {
    return Object.freeze([
      Object.freeze({
        id: 'document-body',
        heading: null,
        body: markdown.trim(),
        startLine: 1,
        endLine: lines.length,
      }),
    ]);
  }

  const sections: MarkdownSection[] = [];
  for (const [index, heading] of headings.entries()) {
    const nextHeading = headings[index + 1];
    const startLine = heading.lineNumber;
    const endLine = (nextHeading?.lineNumber ?? lines.length + 1) - 1;
    const body = lines.slice(startLine, endLine).join('\n').trim();

    sections.push(
      Object.freeze({
        id: heading.normalizedText || `section-${index + 1}`,
        heading,
        body,
        startLine,
        endLine,
      }),
    );
  }

  return Object.freeze(sections);
}

/** Detect malformed ATX heading lines such as missing whitespace after hashes. */
export function detectMalformedMarkdownHeadings(markdown: string): readonly number[] {
  const lines = markdown.split('\n');
  const malformed: number[] = [];

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') && !VALID_HEADING_PATTERN.test(trimmed)) {
      malformed.push(index + 1);
    }
  }

  return Object.freeze(malformed);
}

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

export function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function splitParagraphs(markdown: string): readonly string[] {
  return Object.freeze(
    markdown
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
  );
}

export function splitSentences(paragraph: string): readonly string[] {
  return Object.freeze(
    paragraph
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean),
  );
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
