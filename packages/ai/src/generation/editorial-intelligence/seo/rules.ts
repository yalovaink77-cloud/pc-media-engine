import {
  buildMetaDescription,
  extractMarkdownFaqEntries,
  partitionKeywordCoverage,
} from '@pcme/seo';
import type {
  EditorialFindingInput,
  SeoAnalyzerProfile,
  SeoPatternMarker,
  SeoRequiredSection,
} from '@pcme/shared';
import {
  DEFAULT_SEO_FAQ_SECTION_ALIASES,
  DEFAULT_SEO_META_DESCRIPTION_LENGTH_THRESHOLDS,
  DEFAULT_SEO_META_DESCRIPTION_SECTION_ALIASES,
  DEFAULT_SEO_TITLE_LENGTH_THRESHOLDS,
} from '@pcme/shared';

import type { MarkdownHeading, MarkdownSection } from '../editorial/markdown.js';
import {
  countWords,
  extractMarkdownHeadings,
  extractMarkdownSections,
  normalizeHeadingText,
} from '../editorial/markdown.js';

export interface SeoRuleExecutionContext {
  readonly content: string;
  readonly profile: SeoAnalyzerProfile;
  readonly headings: readonly MarkdownHeading[];
  readonly sections: readonly MarkdownSection[];
}

export type SeoRuleExecutor = (
  context: SeoRuleExecutionContext,
) => readonly EditorialFindingInput[];

export const SEO_RULE_CODES = Object.freeze([
  'missing-h1',
  'duplicate-h1',
  'invalid-heading-hierarchy',
  'weak-title-keyword-coverage',
  'title-too-short',
  'title-too-long',
  'missing-meta-description-candidate',
  'meta-description-too-short',
  'meta-description-too-long',
  'missing-required-topic-entity',
  'thin-content-section',
  'missing-faq-section',
  'insufficient-faq-question-count',
  'duplicate-faq-question',
  'indirect-faq-answer',
  'missing-internal-link-opportunity',
  'missing-external-citation-opportunity',
  'search-intent-gap',
  'missing-required-section',
] as const);

export type SeoRuleCode = (typeof SEO_RULE_CODES)[number];

const SEARCH_INTENT_STOPWORDS = new Set([
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'whose',
  'why',
  'how',
  'does',
  'do',
  'did',
  'is',
  'are',
  'was',
  'were',
  'can',
  'should',
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'your',
  'you',
]);

function resolveTitleThresholds(profile: SeoAnalyzerProfile) {
  return Object.freeze({
    ...DEFAULT_SEO_TITLE_LENGTH_THRESHOLDS,
    ...profile.titleLengthThresholds,
  });
}

function resolveMetaDescriptionThresholds(profile: SeoAnalyzerProfile) {
  return Object.freeze({
    ...DEFAULT_SEO_META_DESCRIPTION_LENGTH_THRESHOLDS,
    ...profile.metaDescriptionLengthThresholds,
  });
}

function resolveMinSectionWordCount(profile: SeoAnalyzerProfile): number {
  return profile.contentCompletenessThresholds?.minSectionWordCount ?? 20;
}

function resolveTitleHeading(headings: readonly MarkdownHeading[]): MarkdownHeading | null {
  return headings.find((heading) => heading.level === 1) ?? null;
}

function sectionMatched(
  section: SeoRequiredSection,
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

  if (section.acceptLeadingH1) {
    const leadingH1 = headings.find((heading) => heading.level === 1);
    if (leadingH1 && leadingH1.normalizedText.length > 0) {
      return true;
    }
  }

  return false;
}

function findSectionByAliases(
  sections: readonly MarkdownSection[],
  aliases: readonly string[],
): MarkdownSection | null {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeadingText(alias)));
  return (
    sections.find((section) => section.heading && aliasSet.has(section.heading.normalizedText)) ??
    null
  );
}

function resolveMetaDescriptionCandidate(
  sections: readonly MarkdownSection[],
  profile: SeoAnalyzerProfile,
): string {
  const aliases =
    profile.metaDescriptionSectionAliases ?? DEFAULT_SEO_META_DESCRIPTION_SECTION_ALIASES;
  const section = findSectionByAliases(sections, aliases);
  const body = section?.body.trim() ?? '';
  return buildMetaDescription('', body);
}

function findFaqSection(
  sections: readonly MarkdownSection[],
  profile: SeoAnalyzerProfile,
): MarkdownSection | null {
  const aliases = profile.faqSectionAliases ?? DEFAULT_SEO_FAQ_SECTION_ALIASES;
  return findSectionByAliases(sections, aliases);
}

function compilePatternMarker(marker: SeoPatternMarker): RegExp {
  return new RegExp(marker.pattern, marker.flags ?? 'i');
}

function hasExternalMarkdownLink(value: string): boolean {
  return /\[[^\]]+\]\(\s*https?:\/\/[^)]+\)/i.test(value);
}

function extractSearchIntentTokens(question: string): readonly string[] {
  return Object.freeze(
    question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3 && !SEARCH_INTENT_STOPWORDS.has(token)),
  );
}

function executeMissingH1(context: SeoRuleExecutionContext): readonly EditorialFindingInput[] {
  const titleHeading = resolveTitleHeading(context.headings);
  if (titleHeading) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'heading:missing-h1',
      category: 'seo' as const,
      code: 'missing-h1',
      analyzerId: 'structure',
      checkId: 'publication-readiness' as const,
      severity: 'high' as const,
      confidence: 'high' as const,
      reason: 'The draft does not contain an H1 title heading.',
      recommendation: 'Add a single H1 title heading at the top of the draft.',
      acceptanceCriteria: 'The draft includes exactly one H1 title heading.',
      location: Object.freeze({ lineRange: Object.freeze({ start: 1, end: 1 }) }),
      metadata: Object.freeze({ h1Count: 0 }),
    }),
  ]);
}

function executeDuplicateH1(context: SeoRuleExecutionContext): readonly EditorialFindingInput[] {
  const h1Headings = context.headings.filter((heading) => heading.level === 1);
  if (h1Headings.length <= 1) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'heading:duplicate-h1',
      category: 'seo' as const,
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
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const findings: EditorialFindingInput[] = [];
  let previousLevel = 0;

  for (const heading of context.headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      findings.push(
        Object.freeze({
          id: `heading:${heading.lineNumber}:invalid-hierarchy`,
          category: 'seo',
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

function executeWeakTitleKeywordCoverage(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const keywords = context.profile.targetKeywords ?? [];
  if (keywords.length === 0) {
    return Object.freeze([]);
  }

  const titleHeading = resolveTitleHeading(context.headings);
  const title = titleHeading?.text ?? '';
  const coverage = partitionKeywordCoverage(title, keywords);
  if (coverage.matched.length > 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'title:weak-keyword-coverage',
      category: 'seo',
      code: 'weak-title-keyword-coverage',
      analyzerId: 'keywords',
      checkId: 'publication-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: `The title does not include any configured target keywords (${keywords.join(', ')}).`,
      recommendation: 'Revise the title to include at least one primary target keyword naturally.',
      acceptanceCriteria: 'The H1 title includes at least one configured target keyword.',
      location: Object.freeze({
        headingText: title,
        lineRange: titleHeading
          ? Object.freeze({ start: titleHeading.lineNumber, end: titleHeading.lineNumber })
          : undefined,
      }),
      metadata: Object.freeze({
        keywordCount: keywords.length,
        matchedKeywordCount: coverage.matched.length,
      }),
    }),
  ]);
}

function executeTitleTooShort(context: SeoRuleExecutionContext): readonly EditorialFindingInput[] {
  if (!context.profile.titleLengthThresholds) {
    return Object.freeze([]);
  }

  const thresholds = resolveTitleThresholds(context.profile);
  const titleHeading = resolveTitleHeading(context.headings);
  const title = titleHeading?.text.trim() ?? '';
  if (title.length >= thresholds.min) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'title:too-short',
      category: 'seo',
      code: 'title-too-short',
      analyzerId: 'metadata',
      checkId: 'publication-readiness',
      severity: title.length === 0 ? 'high' : 'high',
      confidence: 'high',
      reason:
        title.length === 0
          ? 'The draft title is empty and cannot be used for SEO metadata.'
          : `The title contains ${title.length} characters, below the configured minimum of ${thresholds.min}.`,
      recommendation: 'Expand the H1 title to meet the configured minimum length threshold.',
      acceptanceCriteria: `The H1 title reaches at least ${thresholds.min} characters.`,
      location: Object.freeze({
        headingText: title,
        lineRange: titleHeading
          ? Object.freeze({ start: titleHeading.lineNumber, end: titleHeading.lineNumber })
          : undefined,
      }),
      metadata: Object.freeze({ titleLength: title.length, minLength: thresholds.min }),
    }),
  ]);
}

function executeTitleTooLong(context: SeoRuleExecutionContext): readonly EditorialFindingInput[] {
  if (!context.profile.titleLengthThresholds) {
    return Object.freeze([]);
  }

  const thresholds = resolveTitleThresholds(context.profile);
  const titleHeading = resolveTitleHeading(context.headings);
  const title = titleHeading?.text.trim() ?? '';
  if (!title || title.length <= thresholds.max) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'title:too-long',
      category: 'seo',
      code: 'title-too-long',
      analyzerId: 'metadata',
      checkId: 'publication-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: `The title contains ${title.length} characters, above the configured maximum of ${thresholds.max}.`,
      recommendation: 'Shorten the H1 title to stay within the configured SEO length threshold.',
      acceptanceCriteria: `The H1 title stays at or below ${thresholds.max} characters.`,
      location: Object.freeze({
        headingText: title,
        lineRange: titleHeading
          ? Object.freeze({ start: titleHeading.lineNumber, end: titleHeading.lineNumber })
          : undefined,
      }),
      metadata: Object.freeze({ titleLength: title.length, maxLength: thresholds.max }),
    }),
  ]);
}

function executeMissingMetaDescriptionCandidate(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  if (
    !context.profile.metaDescriptionSectionAliases &&
    !context.profile.metaDescriptionLengthThresholds
  ) {
    return Object.freeze([]);
  }

  const candidate = resolveMetaDescriptionCandidate(context.sections, context.profile);
  if (candidate.trim().length > 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'meta:missing-candidate',
      category: 'seo',
      code: 'missing-meta-description-candidate',
      analyzerId: 'metadata',
      checkId: 'publication-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: 'No meta description candidate could be derived from the configured summary section.',
      recommendation:
        'Add substantive summary content that can serve as a meta description candidate.',
      acceptanceCriteria:
        'A meta description candidate can be derived from the configured summary section.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeMetaDescriptionTooShort(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  if (!context.profile.metaDescriptionLengthThresholds) {
    return Object.freeze([]);
  }

  const thresholds = resolveMetaDescriptionThresholds(context.profile);
  const candidate = resolveMetaDescriptionCandidate(context.sections, context.profile).trim();
  if (!candidate || candidate.length >= thresholds.min) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'meta:too-short',
      category: 'seo',
      code: 'meta-description-too-short',
      analyzerId: 'metadata',
      checkId: 'publication-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: `The meta description candidate contains ${candidate.length} characters, below the configured minimum of ${thresholds.min}.`,
      recommendation:
        'Expand the summary section to produce a stronger meta description candidate.',
      acceptanceCriteria: `The meta description candidate reaches at least ${thresholds.min} characters.`,
      metadata: Object.freeze({
        candidateLength: candidate.length,
        minLength: thresholds.min,
      }),
    }),
  ]);
}

function executeMetaDescriptionTooLong(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  if (!context.profile.metaDescriptionLengthThresholds) {
    return Object.freeze([]);
  }

  const thresholds = resolveMetaDescriptionThresholds(context.profile);
  const candidate = resolveMetaDescriptionCandidate(context.sections, context.profile).trim();
  if (!candidate || candidate.length <= thresholds.max) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'meta:too-long',
      category: 'seo',
      code: 'meta-description-too-long',
      analyzerId: 'metadata',
      checkId: 'publication-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: `The meta description candidate contains ${candidate.length} characters, above the configured maximum of ${thresholds.max}.`,
      recommendation:
        'Tighten the summary section so the meta description candidate fits the limit.',
      acceptanceCriteria: `The meta description candidate stays at or below ${thresholds.max} characters.`,
      metadata: Object.freeze({
        candidateLength: candidate.length,
        maxLength: thresholds.max,
      }),
    }),
  ]);
}

function executeMissingRequiredTopicEntity(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const entities = context.profile.requiredEntities ?? [];
  if (entities.length === 0) {
    return Object.freeze([]);
  }

  const coverage = partitionKeywordCoverage(context.content, entities);
  return Object.freeze(
    coverage.missing.map((entity) =>
      Object.freeze({
        id: `entity:${entity}`,
        category: 'seo' as const,
        code: 'missing-required-topic-entity',
        analyzerId: 'entities',
        checkId: 'publication-readiness' as const,
        severity: 'medium' as const,
        confidence: 'high' as const,
        reason: `Required topic entity "${entity}" is not represented in the draft.`,
        recommendation: `Mention "${entity}" explicitly where it supports reader understanding.`,
        acceptanceCriteria: `The draft includes the required topic entity "${entity}".`,
        metadata: Object.freeze({ entity }),
      }),
    ),
  );
}

function executeThinContentSection(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  if (!context.profile.contentCompletenessThresholds) {
    return Object.freeze([]);
  }

  const minWords = resolveMinSectionWordCount(context.profile);
  const findings: EditorialFindingInput[] = [];

  for (const section of context.sections) {
    const wordCount = countWords(section.body);
    if (wordCount > 0 && wordCount < minWords) {
      findings.push(
        Object.freeze({
          id: `section:${section.id}:thin`,
          category: 'seo',
          code: 'thin-content-section',
          analyzerId: 'content-depth',
          checkId: 'publication-readiness',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" contains only ${wordCount} words.`,
          recommendation:
            'Expand the section with substantive on-page content for search coverage.',
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

function executeMissingFaqSection(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  if ((context.profile.minimumFaqCount ?? 0) <= 0 && !context.profile.faqSectionAliases) {
    return Object.freeze([]);
  }

  const faqSection = findFaqSection(context.sections, context.profile);
  if (faqSection) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'section:faq:missing',
      category: 'seo',
      code: 'missing-faq-section',
      analyzerId: 'faq',
      checkId: 'publication-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft does not include a configured FAQ section.',
      recommendation: 'Add an FAQ section with direct question-and-answer pairs.',
      acceptanceCriteria: 'The draft includes a heading that matches the configured FAQ aliases.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeInsufficientFaqQuestionCount(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const minimumFaqCount = context.profile.minimumFaqCount ?? 0;
  if (minimumFaqCount <= 0) {
    return Object.freeze([]);
  }

  const faqSection = findFaqSection(context.sections, context.profile);
  if (!faqSection) {
    return Object.freeze([]);
  }

  const entries = extractMarkdownFaqEntries(faqSection.body);
  if (entries.length >= minimumFaqCount) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'faq:insufficient-count',
      category: 'seo',
      code: 'insufficient-faq-question-count',
      analyzerId: 'faq',
      checkId: 'publication-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: `The FAQ section contains ${entries.length} questions; at least ${minimumFaqCount} are required.`,
      recommendation: 'Add additional FAQ questions that reflect common search intent.',
      acceptanceCriteria: `The FAQ section includes at least ${minimumFaqCount} questions.`,
      location: Object.freeze({
        sectionId: faqSection.id,
        headingText: faqSection.heading?.text,
      }),
      metadata: Object.freeze({ faqCount: entries.length, minimumFaqCount }),
    }),
  ]);
}

function executeDuplicateFaqQuestion(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const faqSection = findFaqSection(context.sections, context.profile);
  if (!faqSection) {
    return Object.freeze([]);
  }

  const seen = new Set<string>();
  const findings: EditorialFindingInput[] = [];

  for (const entry of extractMarkdownFaqEntries(faqSection.body)) {
    if (!entry.normalizedQuestion || seen.has(entry.normalizedQuestion)) {
      if (entry.normalizedQuestion) {
        findings.push(
          Object.freeze({
            id: `faq:duplicate:${entry.normalizedQuestion}`,
            category: 'seo',
            code: 'duplicate-faq-question',
            analyzerId: 'faq',
            checkId: 'formatting',
            severity: 'medium',
            confidence: 'high',
            reason: `FAQ question "${entry.question}" appears more than once.`,
            recommendation: 'Remove or consolidate duplicate FAQ questions.',
            acceptanceCriteria: 'Each FAQ question appears only once.',
            location: Object.freeze({
              sectionId: faqSection.id,
              lineRange: Object.freeze({ start: entry.lineNumber, end: entry.lineNumber }),
            }),
            metadata: Object.freeze({ question: entry.question }),
          }),
        );
      }
      continue;
    }

    seen.add(entry.normalizedQuestion);
  }

  return Object.freeze(findings);
}

function executeIndirectFaqAnswer(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.indirectFaqAnswerPatterns ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const faqSection = findFaqSection(context.sections, context.profile);
  if (!faqSection) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const entry of extractMarkdownFaqEntries(faqSection.body)) {
    for (const marker of patterns) {
      const regex = compilePatternMarker(marker);
      if (!regex.test(entry.answer)) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `faq:indirect:${marker.id}:${entry.normalizedQuestion}`,
          category: 'seo',
          code: 'indirect-faq-answer',
          analyzerId: 'faq',
          checkId: 'publication-readiness',
          severity: 'low',
          confidence: 'high',
          reason: `FAQ answer for "${entry.question}" is indirect or overly vague.`,
          recommendation: 'Provide a more direct FAQ answer grounded in the draft content.',
          acceptanceCriteria: 'FAQ answers address the question directly without vague deferrals.',
          location: Object.freeze({
            sectionId: faqSection.id,
            lineRange: Object.freeze({ start: entry.lineNumber, end: entry.lineNumber + 1 }),
          }),
          metadata: Object.freeze({ markerId: marker.id, question: entry.question }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function executeMissingInternalLinkOpportunity(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const descriptors = context.profile.internalLinkTargetDescriptors ?? [];
  if (descriptors.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const descriptor of descriptors) {
      const regex = new RegExp(descriptor.pattern, descriptor.flags ?? 'i');
      if (!regex.test(section.body)) {
        continue;
      }

      if (/\[[^\]]+\]\(\s*(?!https?:\/\/)[^)]+\)/i.test(section.body)) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `link:internal:${descriptor.id}:${section.id}`,
          category: 'seo',
          code: 'missing-internal-link-opportunity',
          analyzerId: 'links',
          checkId: 'publication-readiness',
          severity: 'low',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" mentions an internal link target without a markdown link.`,
          recommendation:
            descriptor.recommendationHint ??
            'Add a relevant internal markdown link where the topic is discussed.',
          acceptanceCriteria:
            'Configured internal-link topics include at least one markdown link in the draft.',
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
            lineRange: Object.freeze({ start: section.startLine, end: section.endLine }),
          }),
          metadata: Object.freeze({ descriptorId: descriptor.id }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function executeMissingExternalCitationOpportunity(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const markers = context.profile.externalCitationOpportunityMarkers ?? [];
  if (markers.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const marker of markers) {
      const regex = compilePatternMarker(marker);
      if (!regex.test(section.body)) {
        continue;
      }

      if (hasExternalMarkdownLink(section.body)) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `citation:external:${marker.id}:${section.id}`,
          category: 'seo',
          code: 'missing-external-citation-opportunity',
          analyzerId: 'citations',
          checkId: 'citation-readiness',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" contains language that suggests an external citation opportunity.`,
          recommendation:
            'Add an external citation link or structured source reference where the claim appears.',
          acceptanceCriteria:
            'Configured citation-opportunity language is paired with an external link or source reference.',
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
            lineRange: Object.freeze({ start: section.startLine, end: section.endLine }),
          }),
          metadata: Object.freeze({ markerId: marker.id }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function questionCoveredByFaq(question: string, faqSection: MarkdownSection | null): boolean {
  if (!faqSection) {
    return false;
  }

  const tokens = extractSearchIntentTokens(question);
  if (tokens.length === 0) {
    return false;
  }

  for (const entry of extractMarkdownFaqEntries(faqSection.body)) {
    const coverage = partitionKeywordCoverage(entry.normalizedQuestion, tokens);
    if (coverage.matched.length >= Math.ceil(tokens.length / 2)) {
      return true;
    }
  }

  return false;
}

function executeSearchIntentGap(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const questions = context.profile.searchIntentQuestions ?? [];
  if (questions.length === 0) {
    return Object.freeze([]);
  }

  const faqSection = findFaqSection(context.sections, context.profile);
  const findings: EditorialFindingInput[] = [];

  for (const question of questions) {
    if (questionCoveredByFaq(question, faqSection)) {
      continue;
    }

    const tokens = extractSearchIntentTokens(question);
    if (tokens.length === 0) {
      continue;
    }

    const coverage = partitionKeywordCoverage(context.content, tokens);
    const requiredMatches = Math.ceil(tokens.length * 0.6);
    if (coverage.matched.length >= requiredMatches) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `intent:${normalizeHeadingText(question)}`,
        category: 'seo',
        code: 'search-intent-gap',
        analyzerId: 'intent',
        checkId: 'publication-readiness',
        severity: 'medium',
        confidence: 'high',
        reason: `The draft does not sufficiently address the search intent question "${question}".`,
        recommendation:
          'Add direct on-page coverage or an FAQ answer that addresses this search intent question.',
        acceptanceCriteria: `The draft directly addresses the search intent question "${question}".`,
        metadata: Object.freeze({
          question,
          matchedTokenCount: coverage.matched.length,
          missingTokenCount: coverage.missing.length,
        }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeMissingRequiredSection(
  context: SeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const requiredSections = context.profile.requiredSections ?? [];
  if (requiredSections.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(
    requiredSections
      .filter((section) => !sectionMatched(section, context.headings))
      .map((section) =>
        Object.freeze({
          id: `section:${section.id}`,
          category: 'seo' as const,
          code: 'missing-required-section',
          analyzerId: 'structure',
          checkId: 'publication-readiness' as const,
          severity: 'high' as const,
          confidence: 'high' as const,
          reason: `Required SEO section "${section.id}" is missing from the draft.`,
          recommendation: 'Add the required section with a matching ATX heading.',
          acceptanceCriteria: `The draft includes a heading that matches section "${section.id}".`,
          location: Object.freeze({ sectionId: section.id }),
          metadata: Object.freeze({ sectionId: section.id }),
        }),
      ),
  );
}

export const SEO_RULE_EXECUTORS: Readonly<Record<SeoRuleCode, SeoRuleExecutor>> = Object.freeze({
  'missing-h1': executeMissingH1,
  'duplicate-h1': executeDuplicateH1,
  'invalid-heading-hierarchy': executeInvalidHeadingHierarchy,
  'weak-title-keyword-coverage': executeWeakTitleKeywordCoverage,
  'title-too-short': executeTitleTooShort,
  'title-too-long': executeTitleTooLong,
  'missing-meta-description-candidate': executeMissingMetaDescriptionCandidate,
  'meta-description-too-short': executeMetaDescriptionTooShort,
  'meta-description-too-long': executeMetaDescriptionTooLong,
  'missing-required-topic-entity': executeMissingRequiredTopicEntity,
  'thin-content-section': executeThinContentSection,
  'missing-faq-section': executeMissingFaqSection,
  'insufficient-faq-question-count': executeInsufficientFaqQuestionCount,
  'duplicate-faq-question': executeDuplicateFaqQuestion,
  'indirect-faq-answer': executeIndirectFaqAnswer,
  'missing-internal-link-opportunity': executeMissingInternalLinkOpportunity,
  'missing-external-citation-opportunity': executeMissingExternalCitationOpportunity,
  'search-intent-gap': executeSearchIntentGap,
  'missing-required-section': executeMissingRequiredSection,
});

/** Build execution context for SEO rules from markdown content and profile. */
export function createSeoRuleExecutionContext(
  content: string,
  profile: SeoAnalyzerProfile,
): SeoRuleExecutionContext {
  return Object.freeze({
    content,
    profile,
    headings: extractMarkdownHeadings(content),
    sections: extractMarkdownSections(content),
  });
}
