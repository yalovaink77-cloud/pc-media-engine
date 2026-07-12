import { extractMarkdownFaqEntries, normalizeSeoText, partitionKeywordCoverage } from '@pcme/seo';
import type {
  AiSeoAnalyzerProfile,
  AiSeoCanonicalEntity,
  AiSeoPatternMarker,
  EditorialFindingInput,
} from '@pcme/shared';
import {
  DEFAULT_AI_SEO_CHUNKING_TARGETS,
  DEFAULT_AI_SEO_FAQ_SECTION_ALIASES,
  DEFAULT_AI_SEO_SUMMARY_SECTION_ALIASES,
} from '@pcme/shared';

import type { MarkdownSection } from '../editorial/markdown.js';
import {
  countWords,
  extractMarkdownHeadings,
  extractMarkdownSections,
  normalizeHeadingText,
  splitParagraphs,
  splitSentences,
} from '../editorial/markdown.js';

export interface AiSeoRuleExecutionContext {
  readonly content: string;
  readonly profile: AiSeoAnalyzerProfile;
  readonly sections: readonly MarkdownSection[];
}

export type AiSeoRuleExecutor = (
  context: AiSeoRuleExecutionContext,
) => readonly EditorialFindingInput[];

export const AI_SEO_RULE_CODES = Object.freeze([
  'incomplete-canonical-entity-coverage',
  'ambiguous-entity-reference',
  'excessive-pronoun-without-antecedent',
  'missing-direct-answer-opening',
  'indirect-faq-answer',
  'poor-section-chunkability',
  'section-too-long-for-retrieval',
  'section-too-thin-to-stand-alone',
  'missing-heading-led-context',
  'low-source-transparency',
  'missing-manufacturer-versus-verified-labeling',
  'unsupported-authoritative-phrasing',
  'incomplete-audience-question-coverage',
  'duplicated-question-coverage',
  'contradictory-suitability-or-limitation',
  'vague-claim-without-named-subject',
  'low-factual-density',
  'excessive-filler-language',
  'citation-unfriendly-statement',
  'missing-explicit-uncertainty-language',
] as const);

export type AiSeoRuleCode = (typeof AI_SEO_RULE_CODES)[number];

const AUDIENCE_STOPWORDS = new Set([
  'what',
  'when',
  'where',
  'which',
  'who',
  'how',
  'does',
  'do',
  'did',
  'is',
  'are',
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

function compilePatternMarker(marker: AiSeoPatternMarker): RegExp {
  return new RegExp(marker.pattern, marker.flags ?? 'i');
}

function compileGlobalPatternMarker(marker: AiSeoPatternMarker): RegExp {
  const flags = marker.flags ?? 'i';
  const globalFlags = flags.includes('g') ? flags : `${flags}g`;
  return new RegExp(marker.pattern, globalFlags);
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

function entityMentioned(content: string, entity: AiSeoCanonicalEntity): boolean {
  const names = [entity.canonicalName, ...(entity.aliases ?? [])];
  return names.some((name) => normalizeSeoText(content).includes(normalizeSeoText(name)));
}

function extractAudienceTokens(question: string): readonly string[] {
  return Object.freeze(
    question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3 && !AUDIENCE_STOPWORDS.has(token)),
  );
}

function hasNearbyPattern(
  text: string,
  matchIndex: number,
  patterns: readonly AiSeoPatternMarker[],
  window = 240,
): boolean {
  const slice = text.slice(Math.max(0, matchIndex - window), matchIndex + window);
  return patterns.some((marker) => compilePatternMarker(marker).test(slice));
}

function firstSentence(text: string): string {
  const sentences = splitSentences(text.trim());
  return sentences[0] ?? text.trim();
}

function countPatternMatches(text: string, patterns: readonly AiSeoPatternMarker[]): number {
  let total = 0;
  for (const marker of patterns) {
    const matches = text.match(compileGlobalPatternMarker(marker));
    total += matches?.length ?? 0;
  }
  return total;
}

function countCapitalizedTerms(text: string): number {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  return matches?.length ?? 0;
}

function executeIncompleteCanonicalEntityCoverage(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const entities = context.profile.canonicalEntities ?? [];
  if (entities.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(
    entities
      .filter((entity) => !entityMentioned(context.content, entity))
      .map((entity) =>
        Object.freeze({
          id: `entity:${entity.id}:incomplete`,
          category: 'ai-seo' as const,
          code: 'incomplete-canonical-entity-coverage',
          analyzerId: 'entities',
          checkId: 'publication-readiness' as const,
          severity: 'medium' as const,
          confidence: 'high' as const,
          reason: `Canonical entity "${entity.canonicalName}" is not represented clearly enough for machine retrieval.`,
          recommendation:
            'Introduce the canonical entity name early and repeat it in key sections.',
          acceptanceCriteria: `The draft explicitly names "${entity.canonicalName}" or configured aliases.`,
          metadata: Object.freeze({ entityId: entity.id }),
        }),
      ),
  );
}

function executeAmbiguousEntityReference(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const aliases = context.profile.requiredEntityAliases ?? [];
  const pronounPatterns = context.profile.pronounPatterns ?? [];
  if (aliases.length === 0 || pronounPatterns.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    const pronounCount = countPatternMatches(section.body, pronounPatterns);
    if (pronounCount < 2) {
      continue;
    }

    const aliasCoverage = partitionKeywordCoverage(section.body, aliases);
    if (aliasCoverage.matched.length > 0) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `entity:ambiguous:${section.id}`,
        category: 'ai-seo',
        code: 'ambiguous-entity-reference',
        analyzerId: 'entities',
        checkId: 'publication-readiness',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" relies on pronouns without explicit entity references.`,
        recommendation:
          'Replace ambiguous pronouns with explicit canonical entity names in retrieval-critical sections.',
        acceptanceCriteria:
          'Retrieval-critical sections name configured entities instead of unresolved pronouns.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
          lineRange: Object.freeze({ start: section.startLine, end: section.endLine }),
        }),
        metadata: Object.freeze({ pronounCount }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeExcessivePronounWithoutAntecedent(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const pronounPatterns = context.profile.pronounPatterns ?? [];
  const entities = context.profile.canonicalEntities ?? [];
  if (pronounPatterns.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    const pronounCount = countPatternMatches(section.body, pronounPatterns);
    const entityMentions = entities.filter((entity) =>
      entityMentioned(section.body, entity),
    ).length;
    if (pronounCount < 3 || entityMentions > 0) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `pronoun:${section.id}:excessive`,
        category: 'ai-seo',
        code: 'excessive-pronoun-without-antecedent',
        analyzerId: 'clarity',
        checkId: 'publication-readiness',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" uses pronouns without a clear antecedent.`,
        recommendation:
          'Name the subject explicitly before using pronouns so retrieval systems can anchor references.',
        acceptanceCriteria:
          'Pronoun-heavy passages include an explicit named antecedent in the same section.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({ pronounCount, entityMentions }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeMissingDirectAnswerOpening(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.directAnswerPatterns ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const aliases = context.profile.summarySectionAliases ?? DEFAULT_AI_SEO_SUMMARY_SECTION_ALIASES;
  const summarySection = findSectionByAliases(context.sections, aliases);
  if (!summarySection) {
    return Object.freeze([]);
  }

  const opening = firstSentence(summarySection.body);
  const matchesDirectAnswer = patterns.some((marker) => compilePatternMarker(marker).test(opening));
  if (matchesDirectAnswer) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'summary:missing-direct-answer',
      category: 'ai-seo',
      code: 'missing-direct-answer-opening',
      analyzerId: 'answer-precision',
      checkId: 'publication-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: 'The summary opening does not provide a direct, retrieval-friendly answer sentence.',
      recommendation:
        'Begin the summary with a direct answer sentence that names the subject and states the core fact.',
      acceptanceCriteria:
        'The summary opening matches a configured direct-answer pattern for machine synthesis.',
      location: Object.freeze({
        sectionId: summarySection.id,
        headingText: summarySection.heading?.text,
        lineRange: Object.freeze({
          start: summarySection.startLine,
          end: summarySection.startLine,
        }),
      }),
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeIndirectFaqAnswer(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.indirectFaqAnswerPatterns ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const faqSection = findSectionByAliases(
    context.sections,
    context.profile.faqSectionAliases ?? DEFAULT_AI_SEO_FAQ_SECTION_ALIASES,
  );
  if (!faqSection) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const entry of extractMarkdownFaqEntries(faqSection.body)) {
    for (const marker of patterns) {
      if (!compilePatternMarker(marker).test(entry.answer)) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `faq:indirect:${marker.id}:${entry.normalizedQuestion}`,
          category: 'ai-seo',
          code: 'indirect-faq-answer',
          analyzerId: 'faq',
          checkId: 'publication-readiness',
          severity: 'low',
          confidence: 'high',
          reason: `FAQ answer for "${entry.question}" is too indirect for reliable machine synthesis.`,
          recommendation:
            'Rewrite the FAQ answer as a direct, citation-friendly response grounded in named facts.',
          acceptanceCriteria:
            'FAQ answers provide direct responses without vague deferrals or filler phrasing.',
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

function executePoorSectionChunkability(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const chunking = Object.freeze({
    ...DEFAULT_AI_SEO_CHUNKING_TARGETS,
    ...context.profile.chunkingTargets,
  });
  if (!context.profile.chunkingTargets) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    const paragraphs = splitParagraphs(section.body);
    const sectionWords = countWords(section.body);
    if (sectionWords <= (chunking.maxSectionWords ?? 350)) {
      continue;
    }

    const oversizedParagraphs = paragraphs.filter(
      (paragraph) => countWords(paragraph) > (chunking.maxParagraphWords ?? 120),
    );
    if (oversizedParagraphs.length === 0) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `chunk:${section.id}:poor`,
        category: 'ai-seo',
        code: 'poor-section-chunkability',
        analyzerId: 'chunking',
        checkId: 'formatting',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" is difficult to chunk for retrieval.`,
        recommendation:
          'Break long paragraphs or add subheadings so sections form retrieval-friendly chunks.',
        acceptanceCriteria:
          'Long sections are split into smaller paragraphs or subheadings within chunking targets.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({
          sectionWords,
          oversizedParagraphCount: oversizedParagraphs.length,
        }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeSectionTooLongForRetrieval(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const chunking = Object.freeze({
    ...DEFAULT_AI_SEO_CHUNKING_TARGETS,
    ...context.profile.chunkingTargets,
  });
  if (!context.profile.chunkingTargets) {
    return Object.freeze([]);
  }

  const maxWords = chunking.maxSectionWords ?? 350;
  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    const sectionWords = countWords(section.body);
    if (sectionWords <= maxWords) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `chunk:${section.id}:too-long`,
        category: 'ai-seo',
        code: 'section-too-long-for-retrieval',
        analyzerId: 'chunking',
        checkId: 'formatting',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" exceeds the configured retrieval chunk size.`,
        recommendation: 'Split the section into smaller, heading-led chunks for machine retrieval.',
        acceptanceCriteria: `Section word count stays at or below ${maxWords} words or is split further.`,
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({ sectionWords, maxWords }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeSectionTooThinToStandAlone(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const minWords = context.profile.sectionLengthTargets?.minWords;
  if (!minWords) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    const sectionWords = countWords(section.body);
    if (sectionWords === 0 || sectionWords >= minWords) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `section:${section.id}:too-thin`,
        category: 'ai-seo',
        code: 'section-too-thin-to-stand-alone',
        analyzerId: 'chunking',
        checkId: 'publication-readiness',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" is too thin to serve as a standalone retrieval chunk.`,
        recommendation:
          'Expand the section with named facts or merge it into a richer retrieval chunk.',
        acceptanceCriteria: `The section reaches at least ${minWords} words or is merged intentionally.`,
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({ sectionWords, minWords }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeMissingHeadingLedContext(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const minHeadingContextWords =
    context.profile.chunkingTargets?.minHeadingContextWords ??
    DEFAULT_AI_SEO_CHUNKING_TARGETS.minHeadingContextWords;
  if (!context.profile.chunkingTargets) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    if (!section.heading) {
      continue;
    }

    const openingWords = countWords(firstSentence(section.body));
    if (openingWords >= (minHeadingContextWords ?? 8)) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `heading:${section.id}:missing-context`,
        category: 'ai-seo',
        code: 'missing-heading-led-context',
        analyzerId: 'chunking',
        checkId: 'formatting',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading.text}" lacks a heading-led context opening.`,
        recommendation:
          'Open the section with a sentence that restates the heading topic using explicit named entities.',
        acceptanceCriteria:
          'Each major section opens with enough context to stand alone without prior sections.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading.text,
        }),
        metadata: Object.freeze({ openingWords, minHeadingContextWords }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeLowSourceTransparency(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const markers = context.profile.sourceTransparencyMarkers ?? [];
  if (markers.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const marker of markers) {
      const regex = compilePatternMarker(marker);
      const match = regex.exec(section.body);
      if (!match) {
        continue;
      }

      const index = match.index ?? 0;
      const transparent = hasNearbyPattern(
        section.body,
        index,
        context.profile.uncertaintyMarkers ?? [],
      );
      if (transparent) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `source:${marker.id}:${section.id}`,
          category: 'ai-seo',
          code: 'low-source-transparency',
          analyzerId: 'citations',
          checkId: 'citation-readiness',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" uses source-related language without transparent attribution cues.`,
          recommendation:
            'Add explicit source transparency language near evidence-oriented statements.',
          acceptanceCriteria:
            'Source-oriented statements include configured transparency or uncertainty markers nearby.',
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
          }),
          metadata: Object.freeze({ markerId: marker.id }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function executeMissingManufacturerVersusVerifiedLabeling(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const manufacturerMarkers = context.profile.manufacturerClaimMarkers ?? [];
  if (manufacturerMarkers.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const marker of manufacturerMarkers) {
      const regex = compilePatternMarker(marker);
      const match = regex.exec(section.body);
      if (!match) {
        continue;
      }

      const index = match.index ?? 0;
      const labeled =
        hasNearbyPattern(section.body, index, context.profile.uncertaintyMarkers ?? []) ||
        /\bverified\b/i.test(section.body.slice(index, index + 200));
      if (labeled) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `label:${marker.id}:${section.id}`,
          category: 'ai-seo',
          code: 'missing-manufacturer-versus-verified-labeling',
          analyzerId: 'grounding',
          checkId: 'factual-grounding',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" mixes manufacturer positioning without verified-versus-manufacturer labeling.`,
          recommendation:
            'Label manufacturer statements distinctly from verified facts in retrieval-critical passages.',
          acceptanceCriteria:
            'Manufacturer-positioning language is explicitly distinguished from verified facts.',
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
          }),
          metadata: Object.freeze({ markerId: marker.id }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function executeUnsupportedAuthoritativePhrasing(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.unsupportedAuthoritativePatterns ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const marker of patterns) {
      const regex = compilePatternMarker(marker);
      const match = regex.exec(section.body);
      if (!match) {
        continue;
      }

      const index = match.index ?? 0;
      if (hasNearbyPattern(section.body, index, context.profile.uncertaintyMarkers ?? [])) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `authority:${marker.id}:${section.id}`,
          category: 'ai-seo',
          code: 'unsupported-authoritative-phrasing',
          analyzerId: 'grounding',
          checkId: 'factual-grounding',
          severity: 'high',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" uses authoritative phrasing without supporting transparency cues.`,
          recommendation:
            'Soften authoritative phrasing or pair it with explicit evidence and uncertainty language.',
          acceptanceCriteria:
            'Authoritative statements include nearby uncertainty or source transparency markers.',
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
          }),
          metadata: Object.freeze({ markerId: marker.id }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function questionCovered(question: string, content: string, faqBody: string | null): boolean {
  const tokens = extractAudienceTokens(question);
  if (tokens.length === 0) {
    return false;
  }

  const bodyCoverage = partitionKeywordCoverage(content, tokens);
  if (bodyCoverage.matched.length >= Math.ceil(tokens.length * 0.6)) {
    return true;
  }

  if (!faqBody) {
    return false;
  }

  for (const entry of extractMarkdownFaqEntries(faqBody)) {
    const coverage = partitionKeywordCoverage(`${entry.question} ${entry.answer}`, tokens);
    if (coverage.matched.length >= Math.ceil(tokens.length / 2)) {
      return true;
    }
  }

  return false;
}

function executeIncompleteAudienceQuestionCoverage(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const questions = context.profile.audienceQuestions ?? [];
  if (questions.length === 0) {
    return Object.freeze([]);
  }

  const faqSection = findSectionByAliases(
    context.sections,
    context.profile.faqSectionAliases ?? DEFAULT_AI_SEO_FAQ_SECTION_ALIASES,
  );

  return Object.freeze(
    questions
      .filter((question) => !questionCovered(question, context.content, faqSection?.body ?? null))
      .map((question) =>
        Object.freeze({
          id: `audience:${normalizeHeadingText(question)}`,
          category: 'ai-seo' as const,
          code: 'incomplete-audience-question-coverage',
          analyzerId: 'intent',
          checkId: 'publication-readiness' as const,
          severity: 'medium' as const,
          confidence: 'high' as const,
          reason: `The draft does not sufficiently address the audience question "${question}".`,
          recommendation:
            'Add direct coverage or an FAQ answer that addresses this audience question for synthesis tools.',
          acceptanceCriteria: `The draft directly addresses the audience question "${question}".`,
          metadata: Object.freeze({ question }),
        }),
      ),
  );
}

function executeDuplicatedQuestionCoverage(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const questions = context.profile.audienceQuestions ?? [];
  if (questions.length < 2) {
    return Object.freeze([]);
  }

  const buckets = new Map<string, string[]>();
  for (const question of questions) {
    const tokens = extractAudienceTokens(question);
    const bucketKey = tokens.slice(0, 2).join('-') || normalizeHeadingText(question);
    const existing = buckets.get(bucketKey) ?? [];
    existing.push(question);
    buckets.set(bucketKey, existing);
  }

  const duplicates = [...buckets.values()].filter((group) => group.length > 1);
  if (duplicates.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'audience:duplicated-coverage',
      category: 'ai-seo',
      code: 'duplicated-question-coverage',
      analyzerId: 'intent',
      checkId: 'publication-readiness',
      severity: 'low',
      confidence: 'high',
      reason: 'Multiple audience questions appear to target the same retrieval intent bucket.',
      recommendation:
        'Differentiate audience questions so each targets a distinct retrieval intent.',
      acceptanceCriteria:
        'Configured audience questions map to distinct retrieval intents without redundant overlap.',
      metadata: Object.freeze({ duplicateGroupCount: duplicates.length }),
    }),
  ]);
}

function executeContradictorySuitabilityOrLimitation(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const pairs = context.profile.contradictionPatternPairs ?? [];
  if (pairs.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const pair of pairs) {
    const flags = pair.flags ?? 'i';
    const positive = new RegExp(pair.positivePattern, flags);
    const negative = new RegExp(pair.negativePattern, flags);

    let matchedInSection = false;
    for (const section of context.sections) {
      if (!positive.test(section.body) || !negative.test(section.body)) {
        continue;
      }

      matchedInSection = true;
      findings.push(
        Object.freeze({
          id: `contradiction:${pair.id}:${section.id}`,
          category: 'ai-seo',
          code: 'contradictory-suitability-or-limitation',
          analyzerId: 'consistency',
          checkId: 'factual-grounding',
          severity: 'high',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" contains contradictory suitability and limitation statements.`,
          recommendation:
            'Reconcile suitability claims with limitation language so synthesis tools receive a consistent message.',
          acceptanceCriteria:
            'Suitability and limitation statements in the section are aligned and non-contradictory.',
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
          }),
          metadata: Object.freeze({ pairId: pair.id }),
        }),
      );
    }

    if (matchedInSection) {
      continue;
    }

    const positiveSection = context.sections.find((section) => positive.test(section.body));
    const negativeSection = context.sections.find((section) => negative.test(section.body));
    if (!positiveSection || !negativeSection) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `contradiction:${pair.id}:document`,
        category: 'ai-seo',
        code: 'contradictory-suitability-or-limitation',
        analyzerId: 'consistency',
        checkId: 'factual-grounding',
        severity: 'high',
        confidence: 'high',
        reason:
          'The draft contains contradictory suitability and limitation statements across sections.',
        recommendation:
          'Align suitability claims and limitation language so retrieval systems receive a consistent message.',
        acceptanceCriteria:
          'Suitability and limitation statements across the draft are aligned and non-contradictory.',
        location: Object.freeze({
          sectionId: negativeSection.id,
          headingText: negativeSection.heading?.text,
        }),
        metadata: Object.freeze({
          pairId: pair.id,
          positiveSectionId: positiveSection.id,
          negativeSectionId: negativeSection.id,
        }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeVagueClaimWithoutNamedSubject(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.vagueClaimPatterns ?? [];
  const entities = context.profile.canonicalEntities ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const marker of patterns) {
      const regex = compilePatternMarker(marker);
      const match = regex.exec(section.body);
      if (!match) {
        continue;
      }

      const sentence = splitSentences(section.body).find((entry) => regex.test(entry)) ?? match[0]!;
      const named = entities.some((entity) => entityMentioned(sentence, entity));
      if (named) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `vague:${marker.id}:${section.id}`,
          category: 'ai-seo',
          code: 'vague-claim-without-named-subject',
          analyzerId: 'clarity',
          checkId: 'publication-readiness',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" contains a vague claim without a named subject.`,
          recommendation: 'Replace vague claims with named subjects and concrete facts.',
          acceptanceCriteria:
            'Vague claim patterns appear only in sentences that name a canonical entity.',
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
            excerpt: sentence.slice(0, 120),
          }),
          metadata: Object.freeze({ markerId: marker.id }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function executeLowFactualDensity(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const thresholds = context.profile.factualDensityThresholds;
  if (!thresholds) {
    return Object.freeze([]);
  }

  const minMentions = thresholds.minNamedEntityMentionsPerSection ?? 1;
  const minWords = thresholds.minContentWordsPerSection ?? 30;
  const findings: EditorialFindingInput[] = [];

  for (const section of context.sections) {
    const sectionWords = countWords(section.body);
    if (sectionWords < minWords) {
      continue;
    }

    const namedTerms = countCapitalizedTerms(section.body);
    if (namedTerms >= minMentions) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `density:${section.id}:low`,
        category: 'ai-seo',
        code: 'low-factual-density',
        analyzerId: 'density',
        checkId: 'publication-readiness',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" has low factual density for machine retrieval.`,
        recommendation:
          'Add named entities, concrete facts, or specific terms that improve factual density.',
        acceptanceCriteria:
          'Retrieval-critical sections include enough named factual signals for synthesis.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({ namedTerms, minMentions, sectionWords }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeExcessiveFillerLanguage(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.fillerLanguagePatterns ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    const fillerCount = countPatternMatches(section.body, patterns);
    const sectionWords = countWords(section.body);
    if (sectionWords === 0 || fillerCount < 2) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `filler:${section.id}:excessive`,
        category: 'ai-seo',
        code: 'excessive-filler-language',
        analyzerId: 'clarity',
        checkId: 'formatting',
        severity: 'low',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" contains excessive filler language.`,
        recommendation: 'Remove filler phrases and keep retrieval chunks concise and fact-led.',
        acceptanceCriteria: 'Filler language patterns are reduced in retrieval-critical sections.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({ fillerCount, sectionWords }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeCitationUnfriendlyStatement(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.citationUnfriendlyPatterns ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const marker of patterns) {
      if (!compilePatternMarker(marker).test(section.body)) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `citation:${marker.id}:${section.id}`,
          category: 'ai-seo',
          code: 'citation-unfriendly-statement',
          analyzerId: 'citations',
          checkId: 'citation-readiness',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" includes citation-unfriendly phrasing.`,
          recommendation:
            'Rewrite statements so they can be cited with explicit subjects, sources, and boundaries.',
          acceptanceCriteria:
            'Configured citation-unfriendly patterns are removed or rewritten with explicit attribution.',
          location: Object.freeze({
            sectionId: section.id,
            headingText: section.heading?.text,
          }),
          metadata: Object.freeze({ markerId: marker.id }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

function executeMissingExplicitUncertaintyLanguage(
  context: AiSeoRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const uncertaintyMarkers = context.profile.uncertaintyMarkers ?? [];
  if (uncertaintyMarkers.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    const heading = section.heading?.normalizedText ?? '';
    const isLimitationSection = /limitation|uncertaint/i.test(heading);
    const hasLimitationLanguage = /\b(?:no guarantee|may vary|limitations?|uncertaint)/i.test(
      section.body,
    );
    if (!isLimitationSection && !hasLimitationLanguage) {
      continue;
    }

    const hasUncertainty = uncertaintyMarkers.some((marker) =>
      compilePatternMarker(marker).test(section.body),
    );
    if (hasUncertainty) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `uncertainty:${section.id}:missing`,
        category: 'ai-seo',
        code: 'missing-explicit-uncertainty-language',
        analyzerId: 'grounding',
        checkId: 'factual-grounding',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" discusses limitations without explicit uncertainty language.`,
        recommendation:
          'Add explicit uncertainty markers where evidence is incomplete or outcomes vary.',
        acceptanceCriteria: 'Limitation-oriented sections include configured uncertainty language.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({}),
      }),
    );
  }

  return Object.freeze(findings);
}

export const AI_SEO_RULE_EXECUTORS: Readonly<Record<AiSeoRuleCode, AiSeoRuleExecutor>> =
  Object.freeze({
    'incomplete-canonical-entity-coverage': executeIncompleteCanonicalEntityCoverage,
    'ambiguous-entity-reference': executeAmbiguousEntityReference,
    'excessive-pronoun-without-antecedent': executeExcessivePronounWithoutAntecedent,
    'missing-direct-answer-opening': executeMissingDirectAnswerOpening,
    'indirect-faq-answer': executeIndirectFaqAnswer,
    'poor-section-chunkability': executePoorSectionChunkability,
    'section-too-long-for-retrieval': executeSectionTooLongForRetrieval,
    'section-too-thin-to-stand-alone': executeSectionTooThinToStandAlone,
    'missing-heading-led-context': executeMissingHeadingLedContext,
    'low-source-transparency': executeLowSourceTransparency,
    'missing-manufacturer-versus-verified-labeling':
      executeMissingManufacturerVersusVerifiedLabeling,
    'unsupported-authoritative-phrasing': executeUnsupportedAuthoritativePhrasing,
    'incomplete-audience-question-coverage': executeIncompleteAudienceQuestionCoverage,
    'duplicated-question-coverage': executeDuplicatedQuestionCoverage,
    'contradictory-suitability-or-limitation': executeContradictorySuitabilityOrLimitation,
    'vague-claim-without-named-subject': executeVagueClaimWithoutNamedSubject,
    'low-factual-density': executeLowFactualDensity,
    'excessive-filler-language': executeExcessiveFillerLanguage,
    'citation-unfriendly-statement': executeCitationUnfriendlyStatement,
    'missing-explicit-uncertainty-language': executeMissingExplicitUncertaintyLanguage,
  });

/** Build execution context for AI SEO rules from markdown content and profile. */
export function createAiSeoRuleExecutionContext(
  content: string,
  profile: AiSeoAnalyzerProfile,
): AiSeoRuleExecutionContext {
  return Object.freeze({
    content,
    profile,
    sections: extractMarkdownSections(content),
  });
}

export { extractMarkdownHeadings };
