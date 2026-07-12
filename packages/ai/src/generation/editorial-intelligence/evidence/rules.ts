import type {
  EditorialFindingInput,
  EvidenceAnalyzerProfile,
  EvidencePatternMarker,
} from '@pcme/shared';
import {
  DEFAULT_EVIDENCE_NOTES_SECTION_ALIASES,
  DEFAULT_SOURCE_PLACEHOLDER_PATTERN,
} from '@pcme/shared';

import {
  extractMarkdownHeadings,
  extractMarkdownSections,
  type MarkdownSection,
  normalizeHeadingText,
} from '../editorial/markdown.js';

export interface EvidenceRuleExecutionContext {
  readonly content: string;
  readonly profile: EvidenceAnalyzerProfile;
  readonly sections: readonly MarkdownSection[];
  readonly sourceNotesSection: MarkdownSection | null;
}

export type EvidenceRuleExecutor = (
  context: EvidenceRuleExecutionContext,
) => readonly EditorialFindingInput[];

export const EVIDENCE_RULE_CODES = Object.freeze([
  'unresolved-source-placeholder',
  'missing-required-source-placeholder',
  'missing-required-source-section',
  'missing-evidence-notes',
  'unsupported-factual-statement',
  'manufacturer-claim-indicator',
  'recommendation-without-evidence',
  'medical-statement-without-evidence',
  'missing-verification-marker',
  'duplicate-citation-placeholder',
  'orphan-source-reference',
] as const);

export type EvidenceRuleCode = (typeof EVIDENCE_RULE_CODES)[number];

function compilePattern(marker: EvidencePatternMarker): RegExp {
  return new RegExp(marker.pattern, marker.flags ?? 'i');
}

function resolveSourcePlaceholderPattern(profile: EvidenceAnalyzerProfile): RegExp {
  return new RegExp(profile.sourcePlaceholderPattern ?? DEFAULT_SOURCE_PLACEHOLDER_PATTERN, 'gi');
}

function extractPlaceholders(content: string, pattern: RegExp): readonly string[] {
  return Object.freeze(
    [...content.matchAll(pattern)].map((match) => match[0]?.trim() ?? '').filter(Boolean),
  );
}

function normalizePlaceholder(value: string): string {
  return value.trim().toLowerCase();
}

function hasVerificationMarker(content: string, markers: readonly string[]): boolean {
  const normalized = content.toLowerCase();
  return markers.some((marker) => normalized.includes(marker.toLowerCase()));
}

function sectionMatched(
  section: { readonly headingAliases: readonly string[] },
  headings: ReturnType<typeof extractMarkdownHeadings>,
): boolean {
  const aliases = new Set(
    section.headingAliases.map((alias) => normalizeHeadingText(alias)).filter(Boolean),
  );
  return headings.some((heading) => aliases.has(heading.normalizedText));
}

function findSourceNotesSection(
  sections: readonly MarkdownSection[],
  aliases: readonly string[],
): MarkdownSection | null {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeadingText(alias)));
  return (
    sections.find((section) => section.heading && aliasSet.has(section.heading.normalizedText)) ??
    null
  );
}

function paragraphHasVerificationMarker(paragraph: string, markers: readonly string[]): boolean {
  return hasVerificationMarker(paragraph, markers);
}

function executeUnresolvedSourcePlaceholder(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const pattern = resolveSourcePlaceholderPattern(context.profile);
  const placeholders = extractPlaceholders(context.content, pattern);
  if (placeholders.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'source:unresolved-placeholders',
      category: 'evidence' as const,
      code: 'unresolved-source-placeholder',
      analyzerId: 'citation-readiness',
      checkId: 'citation-readiness' as const,
      severity: 'high' as const,
      confidence: 'high' as const,
      reason: `The draft contains ${placeholders.length} unresolved structured source placeholder(s).`,
      recommendation: 'Replace placeholders with resolved source records before publication.',
      acceptanceCriteria: 'No unresolved [Source: ...] placeholders remain in the draft.',
      metadata: Object.freeze({ placeholderCount: placeholders.length }),
    }),
  ]);
}

function executeMissingRequiredSourcePlaceholder(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const required = context.profile.requiredSourcePlaceholders ?? [];
  if (required.length === 0) {
    return Object.freeze([]);
  }

  const normalized = context.content.toLowerCase();
  const missing = required.filter((placeholder) => !normalized.includes(placeholder.toLowerCase()));
  if (missing.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'source:missing-required-placeholders',
      category: 'evidence',
      code: 'missing-required-source-placeholder',
      analyzerId: 'citation-readiness',
      checkId: 'citation-readiness',
      severity: 'high',
      confidence: 'high',
      reason: `The draft is missing ${missing.length} required source placeholder(s).`,
      recommendation:
        'Add the required structured source placeholders to the evidence notes section.',
      acceptanceCriteria: 'All required source placeholders appear in the draft.',
      metadata: Object.freeze({ missingCount: missing.length }),
    }),
  ]);
}

function executeMissingRequiredSourceSection(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const requiredSections = context.profile.requiredEvidenceSections ?? [];
  if (requiredSections.length === 0) {
    return Object.freeze([]);
  }

  const headings = extractMarkdownHeadings(context.content);
  const missing = requiredSections.filter((section) => !sectionMatched(section, headings));

  return Object.freeze(
    missing.map((section) =>
      Object.freeze({
        id: `section:${section.id}`,
        category: 'evidence' as const,
        code: 'missing-required-source-section',
        analyzerId: 'structure',
        checkId: 'citation-readiness',
        severity: 'high',
        confidence: 'high',
        reason: `Required evidence section "${section.id}" is missing from the draft.`,
        recommendation: 'Add the required evidence section with a matching ATX heading.',
        acceptanceCriteria: `The draft includes a heading that matches section "${section.id}".`,
        location: Object.freeze({ sectionId: section.id }),
        metadata: Object.freeze({ sectionId: section.id }),
      }),
    ),
  );
}

function executeMissingEvidenceNotes(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const sourceNotes = context.sourceNotesSection;
  if (!sourceNotes) {
    return Object.freeze([]);
  }

  const verificationMarkers = context.profile.verificationMarkers ?? [];
  const pattern = resolveSourcePlaceholderPattern(context.profile);
  const placeholders = extractPlaceholders(sourceNotes.body, pattern);
  const hasResolvedNotes =
    verificationMarkers.length > 0 && hasVerificationMarker(sourceNotes.body, verificationMarkers);

  if (placeholders.length > 0 && !hasResolvedNotes) {
    return Object.freeze([
      Object.freeze({
        id: 'section:evidence-notes:unresolved',
        category: 'evidence',
        code: 'missing-evidence-notes',
        analyzerId: 'citation-readiness',
        checkId: 'citation-readiness',
        severity: 'high',
        confidence: 'high',
        reason: 'The evidence notes section contains placeholders without resolved source records.',
        recommendation:
          'Replace evidence note placeholders with resolved, traceable source records.',
        acceptanceCriteria:
          'Evidence notes contain resolved source records or verification markers.',
        location: Object.freeze({
          sectionId: sourceNotes.id,
          headingText: sourceNotes.heading?.text,
          lineRange: Object.freeze({ start: sourceNotes.startLine, end: sourceNotes.endLine }),
        }),
      }),
    ]);
  }

  return Object.freeze([]);
}

function executePatternMarkers(
  context: EvidenceRuleExecutionContext,
  markers: readonly EvidencePatternMarker[],
  code:
    | 'unsupported-factual-statement'
    | 'manufacturer-claim-indicator'
    | 'recommendation-without-evidence'
    | 'medical-statement-without-evidence',
  analyzerId: string,
  checkId: 'factual-grounding' | 'citation-readiness' | 'safety',
  reasonPrefix: string,
  severity: 'medium' | 'high',
): readonly EditorialFindingInput[] {
  const findings: EditorialFindingInput[] = [];

  for (const marker of markers) {
    if (!compilePattern(marker).test(context.content)) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `pattern:${marker.id}`,
        category: 'evidence',
        code,
        analyzerId,
        checkId,
        severity,
        confidence: 'high',
        reason: `${reasonPrefix} (${marker.id}).`,
        recommendation:
          'Add traceable evidence notes or revise the statement to reflect uncertainty.',
        acceptanceCriteria: 'The flagged statement is supported by traceable evidence or revised.',
        metadata: Object.freeze({ patternId: marker.id }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeRecommendationWithoutEvidence(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const markers = context.profile.recommendationWithoutEvidenceMarkers ?? [];
  const verificationMarkers = context.profile.verificationMarkers ?? [];
  const findings: EditorialFindingInput[] = [];

  for (const marker of markers) {
    const pattern = compilePattern(marker);
    for (const section of context.sections) {
      for (const paragraph of section.body.split(/\n\s*\n/).filter(Boolean)) {
        if (!pattern.test(paragraph)) {
          continue;
        }

        if (paragraphHasVerificationMarker(paragraph, verificationMarkers)) {
          continue;
        }

        findings.push(
          Object.freeze({
            id: `recommendation:${marker.id}:${section.id}`,
            category: 'evidence',
            code: 'recommendation-without-evidence',
            analyzerId: 'factual-grounding',
            checkId: 'factual-grounding',
            severity: 'medium',
            confidence: 'high',
            reason: `Recommendation language was detected without nearby verification markers (${marker.id}).`,
            recommendation:
              'Add traceable evidence for the recommendation or qualify the statement with uncertainty.',
            acceptanceCriteria:
              'Recommendations are supported by verification markers or resolved source records.',
            location: Object.freeze({
              sectionId: section.id,
              headingText: section.heading?.text,
              excerpt: paragraph.slice(0, 120),
            }),
            metadata: Object.freeze({ patternId: marker.id }),
          }),
        );
      }
    }
  }

  return Object.freeze(findings);
}

function executeMedicalStatementWithoutEvidence(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const markers = context.profile.medicalClaimMarkers ?? [];
  const verificationMarkers = context.profile.verificationMarkers ?? [];
  const findings: EditorialFindingInput[] = [];

  for (const marker of markers) {
    const pattern = compilePattern(marker);
    for (const section of context.sections) {
      for (const paragraph of section.body.split(/\n\s*\n/).filter(Boolean)) {
        if (!pattern.test(paragraph)) {
          continue;
        }

        if (paragraphHasVerificationMarker(paragraph, verificationMarkers)) {
          continue;
        }

        findings.push(
          Object.freeze({
            id: `medical:${marker.id}:${section.id}`,
            category: 'evidence',
            code: 'medical-statement-without-evidence',
            analyzerId: 'factual-grounding',
            checkId: 'safety',
            severity: 'high',
            confidence: 'high',
            reason: `Medical statement language was detected without nearby verification markers (${marker.id}).`,
            recommendation:
              'Qualify medical statements with uncertainty and traceable professional guidance references.',
            acceptanceCriteria:
              'Medical statements include verification markers or explicit uncertainty language.',
            location: Object.freeze({
              sectionId: section.id,
              headingText: section.heading?.text,
              excerpt: paragraph.slice(0, 120),
            }),
            metadata: Object.freeze({ patternId: marker.id }),
          }),
        );
      }
    }
  }

  return Object.freeze(findings);
}

function executeMissingVerificationMarker(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const verificationMarkers = context.profile.verificationMarkers ?? [];
  if (verificationMarkers.length === 0) {
    return Object.freeze([]);
  }

  const claimMarkers = [
    ...(context.profile.unsupportedFactualStatementMarkers ?? []),
    ...(context.profile.recommendationWithoutEvidenceMarkers ?? []),
    ...(context.profile.manufacturerClaimMarkers ?? []),
  ];

  const hasClaims = claimMarkers.some((marker) => compilePattern(marker).test(context.content));
  if (!hasClaims) {
    return Object.freeze([]);
  }

  if (hasVerificationMarker(context.content, verificationMarkers)) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'verification:missing-markers',
      category: 'evidence',
      code: 'missing-verification-marker',
      analyzerId: 'citation-readiness',
      checkId: 'citation-readiness',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft makes evidentiary claims without any configured verification markers.',
      recommendation:
        'Add verification markers or resolved source records that demonstrate traceability.',
      acceptanceCriteria: 'At least one configured verification marker appears in the draft.',
    }),
  ]);
}

function executeDuplicateCitationPlaceholder(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const pattern = resolveSourcePlaceholderPattern(context.profile);
  const placeholders = extractPlaceholders(context.content, pattern);
  const counts = new Map<string, number>();

  for (const placeholder of placeholders) {
    const key = normalizePlaceholder(placeholder);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const findings: EditorialFindingInput[] = [];
  for (const [placeholder, count] of counts.entries()) {
    if (count <= 1) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `source:duplicate:${placeholder}`,
        category: 'evidence',
        code: 'duplicate-citation-placeholder',
        analyzerId: 'citation-readiness',
        checkId: 'citation-readiness',
        severity: 'medium',
        confidence: 'high',
        reason: `Citation placeholder "${placeholder}" appears ${count} times in the draft.`,
        recommendation: 'Deduplicate citation placeholders and consolidate source notes.',
        acceptanceCriteria: 'Each citation placeholder appears only once in the draft.',
        metadata: Object.freeze({ placeholder, repeatCount: count }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeOrphanSourceReference(
  context: EvidenceRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const pattern = resolveSourcePlaceholderPattern(context.profile);
  const allPlaceholders = extractPlaceholders(context.content, pattern);
  if (allPlaceholders.length === 0 || !context.sourceNotesSection) {
    return Object.freeze([]);
  }

  const notesPlaceholders = new Set(
    extractPlaceholders(context.sourceNotesSection.body, pattern).map(normalizePlaceholder),
  );

  const bodyContent = context.sections
    .filter((section) => section.id !== context.sourceNotesSection?.id)
    .map((section) => section.body)
    .join('\n\n');

  const bodyPlaceholders = extractPlaceholders(bodyContent, pattern);
  const findings: EditorialFindingInput[] = [];

  for (const placeholder of bodyPlaceholders) {
    const normalized = normalizePlaceholder(placeholder);
    if (!notesPlaceholders.has(normalized)) {
      findings.push(
        Object.freeze({
          id: `source:orphan:${normalized}`,
          category: 'evidence',
          code: 'orphan-source-reference',
          analyzerId: 'citation-readiness',
          checkId: 'citation-readiness',
          severity: 'medium',
          confidence: 'high',
          reason: `Source reference ${placeholder} appears outside the evidence notes section without a matching note entry.`,
          recommendation:
            'Add the source reference to the evidence notes section or remove the orphan citation.',
          acceptanceCriteria: 'Every inline source reference has a matching evidence notes entry.',
          metadata: Object.freeze({ placeholder }),
        }),
      );
    }
  }

  return Object.freeze(findings);
}

export const EVIDENCE_RULE_EXECUTORS: Readonly<Record<EvidenceRuleCode, EvidenceRuleExecutor>> =
  Object.freeze({
    'unresolved-source-placeholder': executeUnresolvedSourcePlaceholder,
    'missing-required-source-placeholder': executeMissingRequiredSourcePlaceholder,
    'missing-required-source-section': executeMissingRequiredSourceSection,
    'missing-evidence-notes': executeMissingEvidenceNotes,
    'unsupported-factual-statement': (context) =>
      executePatternMarkers(
        context,
        context.profile.unsupportedFactualStatementMarkers ?? [],
        'unsupported-factual-statement',
        'factual-grounding',
        'factual-grounding',
        'Unsupported factual statement pattern detected',
        'medium',
      ),
    'manufacturer-claim-indicator': (context) =>
      executePatternMarkers(
        context,
        context.profile.manufacturerClaimMarkers ?? [],
        'manufacturer-claim-indicator',
        'factual-grounding',
        'factual-grounding',
        'Manufacturer claim indicator detected',
        'medium',
      ),
    'recommendation-without-evidence': executeRecommendationWithoutEvidence,
    'medical-statement-without-evidence': executeMedicalStatementWithoutEvidence,
    'missing-verification-marker': executeMissingVerificationMarker,
    'duplicate-citation-placeholder': executeDuplicateCitationPlaceholder,
    'orphan-source-reference': executeOrphanSourceReference,
  });

export function createEvidenceRuleExecutionContext(
  content: string,
  profile: EvidenceAnalyzerProfile,
): EvidenceRuleExecutionContext {
  const sections = extractMarkdownSections(content);
  const aliases = profile.evidenceNotesSectionAliases ?? DEFAULT_EVIDENCE_NOTES_SECTION_ALIASES;

  return Object.freeze({
    content,
    profile,
    sections,
    sourceNotesSection: findSourceNotesSection(sections, aliases),
  });
}
