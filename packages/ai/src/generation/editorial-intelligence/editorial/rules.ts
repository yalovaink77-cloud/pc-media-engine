import type {
  EditorialAnalyzerProfile,
  EditorialFindingInput,
  EditorialRequiredSection,
} from '@pcme/shared';
import { DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS } from '@pcme/shared';

import type { MarkdownHeading, MarkdownSection } from './markdown.js';
import {
  countWords,
  detectMalformedMarkdownHeadings,
  escapeRegExp,
  extractMarkdownHeadings,
  extractMarkdownSections,
  normalizeHeadingText,
  splitParagraphs,
  splitSentences,
  stripProtectedMarkdownRegions,
} from './markdown.js';

export interface EditorialRuleExecutionContext {
  readonly content: string;
  readonly profile: EditorialAnalyzerProfile;
  readonly headings: readonly MarkdownHeading[];
  readonly sections: readonly MarkdownSection[];
}

export type EditorialRuleExecutor = (
  context: EditorialRuleExecutionContext,
) => readonly EditorialFindingInput[];

export const EDITORIAL_RULE_CODES = Object.freeze([
  'missing-required-section',
  'duplicate-h1',
  'invalid-heading-hierarchy',
  'thin-section',
  'long-paragraph',
  'long-sentence',
  'formatting-corruption',
  'malformed-markdown-heading',
  'repeated-section-heading',
  'promotional-tone',
  'diagnostic-tone',
] as const);

export type EditorialRuleCode = (typeof EDITORIAL_RULE_CODES)[number];

function resolveThresholds(profile: EditorialAnalyzerProfile) {
  return Object.freeze({
    ...DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS,
    ...profile.thresholds,
  });
}

function sectionMatched(
  section: EditorialRequiredSection,
  headings: readonly MarkdownHeading[],
): boolean {
  if (!section) {
    return false;
  }

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

function executeMissingRequiredSection(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const requiredSections = context.profile.requiredSections ?? [];
  if (requiredSections.length === 0) {
    return Object.freeze([]);
  }

  const missing = requiredSections
    .filter((section) => !sectionMatched(section, context.headings))
    .map((section) =>
      Object.freeze({
        id: `section:${section.id}`,
        category: 'editorial' as const,
        code: 'missing-required-section',
        analyzerId: 'structure',
        checkId: 'publication-readiness' as const,
        severity: 'high' as const,
        confidence: 'high' as const,
        reason: `Required section "${section.id}" is missing from the draft.`,
        recommendation: 'Add the required section with a matching ATX heading.',
        acceptanceCriteria: `The draft includes a heading that matches section "${section.id}".`,
        location: Object.freeze({ sectionId: section.id }),
        metadata: Object.freeze({ sectionId: section.id }),
      }),
    );

  return Object.freeze(missing);
}

function executeDuplicateH1(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const h1Headings = context.headings.filter((heading) => heading.level === 1);
  if (h1Headings.length <= 1) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'heading:duplicate-h1',
      category: 'editorial' as const,
      code: 'duplicate-h1',
      analyzerId: 'structure',
      checkId: 'formatting' as const,
      severity: 'high' as const,
      confidence: 'high' as const,
      reason: `The draft contains ${h1Headings.length} H1 headings; only one title heading is expected.`,
      recommendation: 'Keep a single H1 title and demote additional top-level headings.',
      acceptanceCriteria: 'Exactly one H1 heading remains in the draft.',
      location: Object.freeze({
        lineRange: Object.freeze({
          start: h1Headings[1]?.lineNumber ?? h1Headings[0]?.lineNumber ?? 1,
          end: h1Headings[h1Headings.length - 1]?.lineNumber ?? 1,
        }),
      }),
      metadata: Object.freeze({ h1Count: h1Headings.length }),
    }),
  ]);
}

function executeInvalidHeadingHierarchy(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const findings: EditorialFindingInput[] = [];
  let previousLevel = 0;

  for (const heading of context.headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      findings.push(
        Object.freeze({
          id: `heading:${heading.lineNumber}:invalid-hierarchy`,
          category: 'editorial',
          code: 'invalid-heading-hierarchy',
          analyzerId: 'structure',
          checkId: 'formatting',
          severity: 'medium',
          confidence: 'high',
          reason: `Heading "${heading.text}" skips a level after H${previousLevel}.`,
          recommendation:
            'Use consecutive heading levels without skipping (for example H2 then H3).',
          acceptanceCriteria: 'Heading levels progress without skipped levels.',
          location: Object.freeze({
            headingText: heading.text,
            lineRange: Object.freeze({ start: heading.lineNumber, end: heading.lineNumber }),
          }),
          metadata: Object.freeze({
            headingLevel: heading.level,
            previousLevel,
          }),
        }),
      );
    }

    previousLevel = heading.level;
  }

  return Object.freeze(findings);
}

function executeThinSection(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const thresholds = resolveThresholds(context.profile);
  const findings: EditorialFindingInput[] = [];

  for (const section of context.sections) {
    const minWords = section.heading
      ? (context.profile.requiredSections?.find(
          (required) =>
            required.headingAliases.some(
              (alias) => normalizeHeadingText(alias) === section.heading?.normalizedText,
            ) || required.id === section.id,
        )?.minWordCount ?? thresholds.minSectionWordCount)
      : thresholds.minSectionWordCount;

    const wordCount = countWords(section.body);
    if (wordCount > 0 && wordCount < minWords) {
      findings.push(
        Object.freeze({
          id: `section:${section.id}:thin`,
          category: 'editorial',
          code: 'thin-section',
          analyzerId: 'readability',
          checkId: 'publication-readiness',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" contains only ${wordCount} words.`,
          recommendation: 'Expand the section with substantive editorial content or merge it.',
          acceptanceCriteria: `The section reaches at least ${minWords} words or is intentionally removed.`,
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
            lineRange: Object.freeze({ start: section.startLine, end: section.endLine }),
          }),
          metadata: Object.freeze({ wordCount, minWords }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function executeLongParagraph(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const thresholds = resolveThresholds(context.profile);
  const findings: EditorialFindingInput[] = [];

  for (const section of context.sections) {
    for (const [index, paragraph] of splitParagraphs(section.body).entries()) {
      if (paragraph.length > thresholds.maxParagraphCharacterCount) {
        findings.push(
          Object.freeze({
            id: `section:${section.id}:paragraph:${index + 1}:long`,
            category: 'editorial',
            code: 'long-paragraph',
            analyzerId: 'readability',
            checkId: 'formatting',
            severity: 'low',
            confidence: 'high',
            reason: `A paragraph in section "${section.heading?.text ?? section.id}" exceeds ${thresholds.maxParagraphCharacterCount} characters.`,
            recommendation: 'Split the paragraph into shorter blocks for readability.',
            acceptanceCriteria:
              'No paragraph in the section exceeds the configured character limit.',
            location: Object.freeze({
              sectionId: section.id,
              headingText: section.heading?.text,
              excerpt: paragraph.slice(0, 120),
            }),
            metadata: Object.freeze({
              paragraphIndex: index + 1,
              characterCount: paragraph.length,
              maxCharacters: thresholds.maxParagraphCharacterCount,
            }),
          }),
        );
      }
    }
  }

  return Object.freeze(findings);
}

function executeLongSentence(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const thresholds = resolveThresholds(context.profile);
  const findings: EditorialFindingInput[] = [];

  for (const section of context.sections) {
    for (const paragraph of splitParagraphs(section.body)) {
      for (const [index, sentence] of splitSentences(paragraph).entries()) {
        const wordCount = countWords(sentence);
        if (wordCount > thresholds.maxSentenceWordCount) {
          findings.push(
            Object.freeze({
              id: `section:${section.id}:sentence:${index + 1}:long`,
              category: 'editorial',
              code: 'long-sentence',
              analyzerId: 'readability',
              checkId: 'formatting',
              severity: 'medium',
              confidence: 'high',
              reason: `A sentence in section "${section.heading?.text ?? section.id}" contains ${wordCount} words.`,
              recommendation: 'Split the sentence into shorter statements.',
              acceptanceCriteria: `Sentences in the section stay at or below ${thresholds.maxSentenceWordCount} words.`,
              location: Object.freeze({
                sectionId: section.id,
                headingText: section.heading?.text,
                excerpt: sentence.slice(0, 120),
              }),
              metadata: Object.freeze({
                sentenceIndex: index + 1,
                wordCount,
                maxWords: thresholds.maxSentenceWordCount,
              }),
            }),
          );
        }
      }
    }
  }

  return Object.freeze(findings);
}

function executeFormattingCorruption(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const haystack = stripProtectedMarkdownRegions(context.content);
  const findings: EditorialFindingInput[] = [];

  for (const token of context.profile.confirmedMergedWordTokens ?? []) {
    const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
    if (pattern.test(haystack)) {
      findings.push(
        Object.freeze({
          id: `token:${token.toLowerCase()}`,
          category: 'editorial',
          code: 'formatting-corruption',
          analyzerId: 'formatting',
          checkId: 'formatting',
          severity: 'high',
          confidence: 'high',
          reason: `Confirmed merged-word token "${token}" appears in the draft.`,
          recommendation: 'Regenerate or manually correct the affected words with proper spacing.',
          acceptanceCriteria: `The merged token "${token}" no longer appears in the draft.`,
          metadata: Object.freeze({ token, signal: 'confirmed-merged-token' }),
        }),
      );
    }
  }

  if (/\b[a-z]{4,}[A-Z][a-z]{2,}\b/.test(haystack)) {
    findings.push(
      Object.freeze({
        id: 'signal:camelcase-merged-token',
        category: 'editorial',
        code: 'formatting-corruption',
        analyzerId: 'formatting',
        checkId: 'formatting',
        severity: 'high',
        confidence: 'medium',
        reason: 'A camelCase merged-word pattern was detected outside protected Markdown regions.',
        recommendation: 'Review the draft for missing spaces between words.',
        acceptanceCriteria: 'No camelCase merged-word patterns remain outside protected regions.',
        metadata: Object.freeze({ signal: 'camelcase-merged-token' }),
      }),
    );
  }

  for (const patternSource of context.profile.productNameGluePatterns ?? []) {
    const pattern = new RegExp(patternSource, 'i');
    if (pattern.test(context.content.replace(/```[\s\S]*?```/g, ' '))) {
      findings.push(
        Object.freeze({
          id: `signal:product-name-glue:${patternSource}`,
          category: 'editorial',
          code: 'formatting-corruption',
          analyzerId: 'formatting',
          checkId: 'formatting',
          severity: 'high',
          confidence: 'high',
          reason: 'A product-name spacing corruption pattern was detected in the draft.',
          recommendation: 'Restore expected spacing inside product names or headings.',
          acceptanceCriteria: 'Product-name spacing corruption patterns are absent from the draft.',
          metadata: Object.freeze({ signal: 'product-name-glue', pattern: patternSource }),
        }),
      );
    }
  }

  if (/[a-z]\.[A-Z][a-z]/.test(haystack)) {
    findings.push(
      Object.freeze({
        id: 'signal:missing-space-after-sentence',
        category: 'editorial',
        code: 'formatting-corruption',
        analyzerId: 'formatting',
        checkId: 'formatting',
        severity: 'medium',
        confidence: 'medium',
        reason: 'A missing space after sentence punctuation was detected.',
        recommendation: 'Insert the missing space after sentence-ending punctuation.',
        acceptanceCriteria: 'No missing-space-after-sentence patterns remain in the draft.',
        metadata: Object.freeze({ signal: 'missing-space-after-sentence' }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeMalformedMarkdownHeading(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const malformedLines = detectMalformedMarkdownHeadings(context.content);
  if (malformedLines.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(
    malformedLines.map((lineNumber) =>
      Object.freeze({
        id: `heading:${lineNumber}:malformed`,
        category: 'editorial',
        code: 'malformed-markdown-heading',
        analyzerId: 'structure',
        checkId: 'formatting',
        severity: 'high',
        confidence: 'high',
        reason: `Malformed Markdown heading syntax detected on line ${lineNumber}.`,
        recommendation:
          'Use ATX headings with a space after the hash marks (for example "## Title").',
        acceptanceCriteria: 'All heading lines use valid ATX Markdown syntax.',
        location: Object.freeze({
          lineRange: Object.freeze({ start: lineNumber, end: lineNumber }),
        }),
        metadata: Object.freeze({ lineNumber }),
      }),
    ),
  );
}

function executeRepeatedSectionHeading(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const counts = new Map<string, MarkdownHeading[]>();

  for (const heading of context.headings) {
    if (!heading.normalizedText) {
      continue;
    }

    const existing = counts.get(heading.normalizedText) ?? [];
    existing.push(heading);
    counts.set(heading.normalizedText, existing);
  }

  const findings: EditorialFindingInput[] = [];
  for (const [normalizedText, headings] of counts.entries()) {
    if (headings.length <= 1) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `heading:repeated:${normalizedText}`,
        category: 'editorial',
        code: 'repeated-section-heading',
        analyzerId: 'structure',
        checkId: 'publication-readiness',
        severity: 'medium',
        confidence: 'high',
        reason: `Heading "${headings[0]?.text ?? normalizedText}" appears ${headings.length} times.`,
        recommendation: 'Rename or merge duplicated section headings.',
        acceptanceCriteria: 'Each section heading text appears only once in the draft.',
        location: Object.freeze({
          headingText: headings[0]?.text,
          lineRange: Object.freeze({
            start: headings[0]?.lineNumber ?? 1,
            end: headings[headings.length - 1]?.lineNumber ?? 1,
          }),
        }),
        metadata: Object.freeze({ repeatCount: headings.length }),
      }),
    );
  }

  return Object.freeze(findings);
}

function compileTonePattern(pattern: {
  readonly pattern: string;
  readonly flags?: string;
}): RegExp {
  return new RegExp(pattern.pattern, pattern.flags ?? 'i');
}

function executeTonePatterns(
  context: EditorialRuleExecutionContext,
  patterns: readonly { readonly id: string; readonly pattern: string; readonly flags?: string }[],
  code: 'promotional-tone' | 'diagnostic-tone',
  analyzerId: string,
  reasonPrefix: string,
): readonly EditorialFindingInput[] {
  const findings: EditorialFindingInput[] = [];

  for (const entry of patterns) {
    const pattern = compileTonePattern(entry);
    if (!pattern.test(context.content)) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `tone:${entry.id}`,
        category: 'editorial',
        code,
        analyzerId,
        checkId: 'safety',
        severity: 'medium',
        confidence: 'high',
        reason: `${reasonPrefix} (${entry.id}).`,
        recommendation: 'Revise the language to remain educational and non-promotional.',
        acceptanceCriteria: 'The flagged tone pattern no longer appears in the draft.',
        metadata: Object.freeze({ patternId: entry.id }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executePromotionalTone(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  return executeTonePatterns(
    context,
    context.profile.promotionalTonePatterns ?? [],
    'promotional-tone',
    'tone',
    'Promotional tone language was detected',
  );
}

function executeDiagnosticTone(
  context: EditorialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  return executeTonePatterns(
    context,
    context.profile.diagnosticTonePatterns ?? [],
    'diagnostic-tone',
    'tone',
    'Diagnostic or urgent medical tone language was detected',
  );
}

export const EDITORIAL_RULE_EXECUTORS: Readonly<Record<EditorialRuleCode, EditorialRuleExecutor>> =
  Object.freeze({
    'missing-required-section': executeMissingRequiredSection,
    'duplicate-h1': executeDuplicateH1,
    'invalid-heading-hierarchy': executeInvalidHeadingHierarchy,
    'thin-section': executeThinSection,
    'long-paragraph': executeLongParagraph,
    'long-sentence': executeLongSentence,
    'formatting-corruption': executeFormattingCorruption,
    'malformed-markdown-heading': executeMalformedMarkdownHeading,
    'repeated-section-heading': executeRepeatedSectionHeading,
    'promotional-tone': executePromotionalTone,
    'diagnostic-tone': executeDiagnosticTone,
  });

export function createEditorialRuleExecutionContext(
  content: string,
  profile: EditorialAnalyzerProfile,
): EditorialRuleExecutionContext {
  const headings = extractMarkdownHeadings(content);
  return Object.freeze({
    content,
    profile,
    headings,
    sections: extractMarkdownSections(content),
  });
}
