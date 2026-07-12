import type { CommercialAnalyzerProfile, CommercialPatternMarker } from '@pcme/shared';
import type { EditorialFindingInput } from '@pcme/shared';
import {
  DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES,
} from '@pcme/shared';

import type { MarkdownSection } from '../editorial/markdown.js';
import {
  countWords,
  extractMarkdownSections,
  normalizeHeadingText,
} from '../editorial/markdown.js';

export interface CommercialRuleExecutionContext {
  readonly content: string;
  readonly profile: CommercialAnalyzerProfile;
  readonly sections: readonly MarkdownSection[];
}

export type CommercialRuleExecutor = (
  context: CommercialRuleExecutionContext,
) => readonly EditorialFindingInput[];

export const COMMERCIAL_RULE_CODES = Object.freeze([
  'affiliate-disclosure-missing',
  'affiliate-disclosure-misplaced',
  'affiliate-disclosure-duplicate',
  'commercial-relationship-not-disclosed',
  'single-product-bias',
  'missing-alternatives',
  'missing-disadvantages',
  'missing-advantages',
  'missing-comparison-opportunity',
  'unsupported-purchase-recommendation',
  'overly-promotional-language',
  'commercial-call-to-action-imbalance',
  'price-mention-without-context',
  'availability-claim-without-qualification',
  'sponsored-wording-indicator',
  'missing-neutrality-statement',
  'missing-product-suitability-section',
  'missing-who-should-avoid-guidance',
  'missing-decision-support-information',
  'imbalanced-pros-cons-ratio',
  'commercial-repetition',
] as const);

export type CommercialRuleCode = (typeof COMMERCIAL_RULE_CODES)[number];

function compilePatternMarker(marker: CommercialPatternMarker): RegExp {
  return new RegExp(marker.pattern, marker.flags ?? 'i');
}

function compileGlobalPatternMarker(marker: CommercialPatternMarker): RegExp {
  const flags = marker.flags ?? 'i';
  const globalFlags = flags.includes('g') ? flags : `${flags}g`;
  return new RegExp(marker.pattern, globalFlags);
}

function countPatternMatches(text: string, patterns: readonly CommercialPatternMarker[]): number {
  let total = 0;
  for (const marker of patterns) {
    const matches = text.match(compileGlobalPatternMarker(marker));
    total += matches?.length ?? 0;
  }
  return total;
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

function countBulletItems(body: string): number {
  return body.split('\n').filter((line) => /^\s*[-*]\s+/.test(line)).length;
}

function hasResolvedDisclosure(
  content: string,
  markers: readonly string[],
  placeholderPatterns: readonly string[],
): boolean {
  const hasPlaceholder = placeholderPatterns.some((pattern) =>
    new RegExp(pattern, 'i').test(content),
  );
  if (hasPlaceholder) {
    return false;
  }
  return markers.some((marker) => content.toLowerCase().includes(marker.toLowerCase()));
}

function executeAffiliateDisclosureMissing(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const disclosure = context.profile.disclosure;
  if (!disclosure) {
    return Object.freeze([]);
  }

  const sectionAliases = disclosure.sectionAliases ?? DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES;
  const disclosureSection = findSectionByAliases(context.sections, sectionAliases);
  const markers = disclosure.resolvedDisclosureMarkers ?? [];
  const placeholders = disclosure.placeholderPatterns ?? [];

  const candidate = disclosureSection?.body ?? '';
  if (hasResolvedDisclosure(candidate, markers, placeholders)) {
    return Object.freeze([]);
  }

  if (!disclosureSection && markers.length === 0 && placeholders.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'disclosure:affiliate:missing',
      category: 'commercial' as const,
      code: 'affiliate-disclosure-missing',
      analyzerId: 'disclosure',
      checkId: 'affiliate-compliance' as const,
      severity: 'high' as const,
      confidence: 'high' as const,
      reason: 'A resolved affiliate or commercial disclosure is missing from the draft.',
      recommendation:
        'Add a clear, human-readable disclosure that explains commercial relationships before publication.',
      acceptanceCriteria:
        'The draft includes a resolved disclosure statement rather than a placeholder.',
      location: disclosureSection
        ? Object.freeze({
            sectionId: disclosureSection.id,
            headingText: disclosureSection.heading?.text,
          })
        : undefined,
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeAffiliateDisclosureMisplaced(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const disclosure = context.profile.disclosure;
  if (!disclosure?.expectedPlacement) {
    return Object.freeze([]);
  }

  const sectionAliases = disclosure.sectionAliases ?? DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES;
  const disclosureSection = findSectionByAliases(context.sections, sectionAliases);
  if (!disclosureSection) {
    return Object.freeze([]);
  }

  const sectionIndex = context.sections.findIndex((section) => section.id === disclosureSection.id);
  const isAtEnd = sectionIndex === context.sections.length - 1;
  const isAtBeginning = sectionIndex <= 1;

  if (disclosure.expectedPlacement === 'end' && isAtEnd) {
    return Object.freeze([]);
  }
  if (disclosure.expectedPlacement === 'beginning' && isAtBeginning) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'disclosure:affiliate:misplaced',
      category: 'commercial',
      code: 'affiliate-disclosure-misplaced',
      analyzerId: 'disclosure',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: `The disclosure section is not placed at the expected ${disclosure.expectedPlacement} of the draft.`,
      recommendation:
        'Move the disclosure to the configured publication position for transparency.',
      acceptanceCriteria: `The disclosure appears at the configured ${disclosure.expectedPlacement} position.`,
      location: Object.freeze({
        sectionId: disclosureSection.id,
        headingText: disclosureSection.heading?.text,
      }),
      metadata: Object.freeze({ expectedPlacement: disclosure.expectedPlacement }),
    }),
  ]);
}

function executeAffiliateDisclosureDuplicate(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const disclosure = context.profile.disclosure;
  if (!disclosure) {
    return Object.freeze([]);
  }

  const sectionAliases = disclosure.sectionAliases ?? DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES;
  const matches = context.sections.filter(
    (section) =>
      section.heading &&
      sectionAliases.some(
        (alias) => normalizeHeadingText(alias) === section.heading?.normalizedText,
      ),
  );

  if (matches.length <= 1) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'disclosure:affiliate:duplicate',
      category: 'commercial',
      code: 'affiliate-disclosure-duplicate',
      analyzerId: 'disclosure',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft contains duplicate affiliate disclosure sections.',
      recommendation: 'Keep a single disclosure section in the configured location.',
      acceptanceCriteria: 'Only one affiliate disclosure section remains in the draft.',
      metadata: Object.freeze({ disclosureSectionCount: matches.length }),
    }),
  ]);
}

function executeCommercialRelationshipNotDisclosed(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const markers = context.profile.commercialRelationshipMarkers ?? [];
  if (markers.length === 0) {
    return Object.freeze([]);
  }

  const disclosure = context.profile.disclosure;
  const sectionAliases =
    disclosure?.sectionAliases ?? DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES;
  const disclosureSection = findSectionByAliases(context.sections, sectionAliases);
  const resolved = hasResolvedDisclosure(
    disclosureSection?.body ?? '',
    disclosure?.resolvedDisclosureMarkers ?? [],
    disclosure?.placeholderPatterns ?? [],
  );

  const relationshipMentioned = markers.some((marker) =>
    compilePatternMarker(marker).test(context.content),
  );
  if (!relationshipMentioned || resolved) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'disclosure:relationship:not-disclosed',
      category: 'commercial',
      code: 'commercial-relationship-not-disclosed',
      analyzerId: 'disclosure',
      checkId: 'affiliate-compliance',
      severity: 'high',
      confidence: 'high',
      reason: 'Commercial relationship language appears without a matching disclosure statement.',
      recommendation:
        'Pair commercial relationship references with an explicit disclosure statement.',
      acceptanceCriteria:
        'Commercial relationship language is accompanied by a resolved disclosure statement.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeSingleProductBias(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const indicators = context.profile.singleProductBiasIndicators ?? [];
  if (indicators.length === 0) {
    return Object.freeze([]);
  }

  const alternativesAliases =
    context.profile.requiredAlternativesSection?.headingAliases ??
    DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES;
  const alternativesSection = findSectionByAliases(context.sections, alternativesAliases);
  const alternativeCount = alternativesSection ? countBulletItems(alternativesSection.body) : 0;

  const biasCount = countPatternMatches(context.content, indicators);
  if (biasCount < 2 || alternativeCount > 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'bias:single-product',
      category: 'commercial',
      code: 'single-product-bias',
      analyzerId: 'neutrality',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft reads as single-product biased without meaningful alternatives coverage.',
      recommendation:
        'Balance product-focused language with alternatives and decision-support context.',
      acceptanceCriteria:
        'The draft includes alternatives and avoids single-product bias indicators.',
      metadata: Object.freeze({ biasCount, alternativeCount }),
    }),
  ]);
}

function executeMissingAlternatives(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const sectionDef = context.profile.requiredAlternativesSection;
  const minimumCount = context.profile.minimumAlternativesCount ?? 0;
  if (!sectionDef && minimumCount <= 0) {
    return Object.freeze([]);
  }

  const aliases = sectionDef?.headingAliases ?? DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES;
  const alternativesSection = findSectionByAliases(context.sections, aliases);

  if (!alternativesSection) {
    return Object.freeze([
      Object.freeze({
        id: 'section:alternatives:missing',
        category: 'commercial',
        code: 'missing-alternatives',
        analyzerId: 'structure',
        checkId: 'affiliate-compliance',
        severity: 'medium',
        confidence: 'high',
        reason: 'The draft does not include a required alternatives section.',
        recommendation: 'Add an alternatives section that helps readers compare options neutrally.',
        acceptanceCriteria:
          'The draft includes a heading that matches the configured alternatives aliases.',
        metadata: Object.freeze({}),
      }),
    ]);
  }

  const alternativeCount = countBulletItems(alternativesSection.body);
  if (minimumCount > 0 && alternativeCount < minimumCount) {
    return Object.freeze([
      Object.freeze({
        id: 'section:alternatives:insufficient',
        category: 'commercial',
        code: 'missing-alternatives',
        analyzerId: 'structure',
        checkId: 'affiliate-compliance',
        severity: 'medium',
        confidence: 'high',
        reason: `The alternatives section lists ${alternativeCount} options; at least ${minimumCount} are required.`,
        recommendation: 'Add additional neutral alternatives to support reader decision-making.',
        acceptanceCriteria: `The alternatives section includes at least ${minimumCount} options.`,
        location: Object.freeze({
          sectionId: alternativesSection.id,
          headingText: alternativesSection.heading?.text,
        }),
        metadata: Object.freeze({ alternativeCount, minimumCount }),
      }),
    ]);
  }

  return Object.freeze([]);
}

function executeMissingDisadvantages(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const aliases = context.profile.disadvantagesSectionAliases;
  if (!aliases || aliases.length === 0) {
    return Object.freeze([]);
  }

  const section = findSectionByAliases(context.sections, aliases);
  if (section && countWords(section.body) > 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'section:disadvantages:missing',
      category: 'commercial',
      code: 'missing-disadvantages',
      analyzerId: 'structure',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft does not include a disadvantages or limitations section.',
      recommendation:
        'Add a limitations section that presents balanced decision-support information.',
      acceptanceCriteria: 'The draft includes a configured disadvantages or limitations section.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeMissingAdvantages(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const aliases = context.profile.advantagesSectionAliases;
  if (!aliases || aliases.length === 0) {
    return Object.freeze([]);
  }

  const section = findSectionByAliases(context.sections, aliases);
  if (section && countWords(section.body) > 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'section:advantages:missing',
      category: 'commercial',
      code: 'missing-advantages',
      analyzerId: 'structure',
      checkId: 'affiliate-compliance',
      severity: 'low',
      confidence: 'high',
      reason: 'The draft does not include an advantages section.',
      recommendation: 'Add an advantages section with balanced, evidence-aware language.',
      acceptanceCriteria: 'The draft includes a configured advantages section.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeMissingComparisonOpportunity(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const aliases = context.profile.comparisonSectionAliases;
  if (!aliases || aliases.length === 0) {
    return Object.freeze([]);
  }

  const section = findSectionByAliases(context.sections, aliases);
  if (section) {
    return Object.freeze([]);
  }

  const alternativesSection = findSectionByAliases(
    context.sections,
    context.profile.requiredAlternativesSection?.headingAliases ??
      DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
  );
  if (alternativesSection && countWords(alternativesSection.body) >= 20) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'section:comparison:missing',
      category: 'commercial',
      code: 'missing-comparison-opportunity',
      analyzerId: 'structure',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft lacks comparison context to support neutral product evaluation.',
      recommendation:
        'Add comparison or alternatives content that helps readers evaluate options without sales pressure.',
      acceptanceCriteria:
        'The draft includes configured comparison or sufficiently detailed alternatives coverage.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeUnsupportedPurchaseRecommendation(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.unsupportedPurchaseRecommendationPatterns ?? [];
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
          id: `purchase:${marker.id}:${section.id}`,
          category: 'commercial',
          code: 'unsupported-purchase-recommendation',
          analyzerId: 'recommendations',
          checkId: 'affiliate-compliance',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" includes purchase-oriented recommendation language.`,
          recommendation:
            'Replace purchase recommendations with neutral decision-support guidance grounded in evidence.',
          acceptanceCriteria:
            'Purchase-oriented recommendation language is removed or supported with balanced context.',
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

function executeOverlyPromotionalLanguage(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.promotionalLanguagePatterns ?? [];
  const thresholds = context.profile.promotionThresholds;
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const maxCount = thresholds?.maxPromotionalPhraseCount ?? 2;
  const findings: EditorialFindingInput[] = [];

  for (const section of context.sections) {
    const promotionalCount = countPatternMatches(section.body, patterns);
    if (promotionalCount <= maxCount) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `promotion:${section.id}:excessive`,
        category: 'commercial',
        code: 'overly-promotional-language',
        analyzerId: 'neutrality',
        checkId: 'affiliate-compliance',
        severity: 'medium',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" contains overly promotional language.`,
        recommendation:
          'Replace promotional phrasing with neutral, trust-oriented language that prioritizes reader benefit.',
        acceptanceCriteria:
          'Promotional language in the section stays within configured neutrality thresholds.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({ promotionalCount, maxCount }),
      }),
    );
  }

  return Object.freeze(findings);
}

function executeCommercialCallToActionImbalance(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.callToActionPatterns ?? [];
  const maxCount = context.profile.promotionThresholds?.maxCallToActionCount;
  if (patterns.length === 0 || !maxCount) {
    return Object.freeze([]);
  }

  const totalCtas = countPatternMatches(context.content, patterns);
  if (totalCtas <= maxCount) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'cta:imbalance',
      category: 'commercial',
      code: 'commercial-call-to-action-imbalance',
      analyzerId: 'neutrality',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: `The draft contains ${totalCtas} commercial call-to-action phrases, above the configured maximum of ${maxCount}.`,
      recommendation:
        'Reduce call-to-action phrasing to keep the review educational and trust-oriented.',
      acceptanceCriteria: `Commercial call-to-action phrases stay at or below ${maxCount}.`,
      metadata: Object.freeze({ totalCtas, maxCount }),
    }),
  ]);
}

function executePriceMentionWithoutContext(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.priceMentionPatterns ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const marker of patterns) {
      if (!compilePatternMarker(marker).test(section.body)) {
        continue;
      }

      const hasContext =
        /\b(?:from|around|approximately|typical|range|compare|pricing|cost)\b/i.test(section.body);
      if (hasContext) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `price:${marker.id}:${section.id}`,
          category: 'commercial',
          code: 'price-mention-without-context',
          analyzerId: 'claims',
          checkId: 'affiliate-compliance',
          severity: 'low',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" mentions price without contextual qualification.`,
          recommendation:
            'Add neutral pricing context or remove price mentions that cannot be supported.',
          acceptanceCriteria: 'Price mentions include contextual qualification or are removed.',
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

function executeAvailabilityClaimWithoutQualification(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.availabilityClaimPatterns ?? [];
  if (patterns.length === 0) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    for (const marker of patterns) {
      if (!compilePatternMarker(marker).test(section.body)) {
        continue;
      }

      const qualified = /\b(?:may|might|often|typically|availability varies|depending on)\b/i.test(
        section.body,
      );
      if (qualified) {
        continue;
      }

      findings.push(
        Object.freeze({
          id: `availability:${marker.id}:${section.id}`,
          category: 'commercial',
          code: 'availability-claim-without-qualification',
          analyzerId: 'claims',
          checkId: 'affiliate-compliance',
          severity: 'low',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" makes an availability claim without qualification.`,
          recommendation: 'Qualify availability statements or remove unsupported certainty.',
          acceptanceCriteria: 'Availability claims include explicit qualification language.',
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

function executeSponsoredWordingIndicator(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.sponsoredWordingPatterns ?? [];
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
          id: `sponsored:${marker.id}:${section.id}`,
          category: 'commercial',
          code: 'sponsored-wording-indicator',
          analyzerId: 'disclosure',
          checkId: 'affiliate-compliance',
          severity: 'medium',
          confidence: 'high',
          reason: `Section "${section.heading?.text ?? section.id}" contains sponsored wording indicators.`,
          recommendation:
            'Replace sponsored wording with neutral editorial language and ensure disclosure is present.',
          acceptanceCriteria:
            'Sponsored wording indicators are removed or paired with explicit disclosure.',
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

function executeMissingNeutralityStatement(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const markers = context.profile.neutralityMarkers ?? [];
  const thresholds = context.profile.promotionThresholds;
  if (markers.length === 0) {
    return Object.freeze([]);
  }

  const promotionalPatterns = context.profile.promotionalLanguagePatterns ?? [];
  const promotionalCount =
    promotionalPatterns.length > 0 ? countPatternMatches(context.content, promotionalPatterns) : 0;
  const minNeutrality = thresholds?.minNeutralityMarkerCount ?? 1;
  const neutralityCount = countPatternMatches(
    context.content,
    markers.map((marker) => Object.freeze({ ...marker })),
  );

  if (promotionalCount === 0 || neutralityCount >= minNeutrality) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'neutrality:missing',
      category: 'commercial',
      code: 'missing-neutrality-statement',
      analyzerId: 'neutrality',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft uses promotional language without configured neutrality statements.',
      recommendation:
        'Add explicit neutrality language that clarifies editorial independence and reader-first intent.',
      acceptanceCriteria:
        'Configured neutrality markers appear when promotional language is present.',
      metadata: Object.freeze({ promotionalCount, neutralityCount, minNeutrality }),
    }),
  ]);
}

function executeMissingProductSuitabilitySection(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const aliases = context.profile.suitabilitySectionAliases;
  if (!aliases || aliases.length === 0) {
    return Object.freeze([]);
  }

  const section = findSectionByAliases(context.sections, aliases);
  if (section && countWords(section.body) > 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'section:suitability:missing',
      category: 'commercial',
      code: 'missing-product-suitability-section',
      analyzerId: 'structure',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft does not include a product suitability section.',
      recommendation:
        'Add a suitability section that explains who the product may or may not fit without sales pressure.',
      acceptanceCriteria: 'The draft includes a configured product suitability section.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeMissingWhoShouldAvoidGuidance(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const aliases = context.profile.whoShouldAvoidSectionAliases;
  if (!aliases || aliases.length === 0) {
    return Object.freeze([]);
  }

  const section = findSectionByAliases(context.sections, aliases);
  if (section && countWords(section.body) > 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'section:who-should-avoid:missing',
      category: 'commercial',
      code: 'missing-who-should-avoid-guidance',
      analyzerId: 'structure',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft does not include guidance on who should avoid the product.',
      recommendation:
        'Add explicit guidance on who should avoid or reconsider the product to improve publication trust.',
      acceptanceCriteria: 'The draft includes configured who-should-avoid guidance.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeMissingDecisionSupportInformation(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const aliases = context.profile.decisionSupportSectionAliases;
  if (!aliases || aliases.length === 0) {
    return Object.freeze([]);
  }

  const section = findSectionByAliases(context.sections, aliases);
  if (section && countWords(section.body) > 0) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'section:decision-support:missing',
      category: 'commercial',
      code: 'missing-decision-support-information',
      analyzerId: 'structure',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason: 'The draft lacks decision-support information for readers.',
      recommendation:
        'Add decision-support content that helps readers evaluate fit without steering toward purchase.',
      acceptanceCriteria: 'The draft includes configured decision-support information.',
      metadata: Object.freeze({}),
    }),
  ]);
}

function executeImbalancedProsConsRatio(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const ratio = context.profile.prosConsThresholds?.minDisadvantagesToAdvantagesRatio;
  if (!ratio) {
    return Object.freeze([]);
  }

  const advantages = findSectionByAliases(
    context.sections,
    context.profile.advantagesSectionAliases ?? DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES,
  );
  const disadvantages = findSectionByAliases(
    context.sections,
    context.profile.disadvantagesSectionAliases ?? DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES,
  );

  if (!advantages || !disadvantages) {
    return Object.freeze([]);
  }

  const advantageWords = countWords(advantages.body);
  const disadvantageWords = countWords(disadvantages.body);
  if (advantageWords === 0 || disadvantageWords / advantageWords >= ratio) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      id: 'balance:pros-cons:imbalanced',
      category: 'commercial',
      code: 'imbalanced-pros-cons-ratio',
      analyzerId: 'neutrality',
      checkId: 'affiliate-compliance',
      severity: 'medium',
      confidence: 'high',
      reason:
        'Advantages coverage outweighs disadvantages coverage in a way that reduces publication neutrality.',
      recommendation:
        'Expand limitations coverage or reduce promotional advantages so pros and cons remain balanced.',
      acceptanceCriteria:
        'Disadvantages coverage meets the configured balance ratio relative to advantages coverage.',
      metadata: Object.freeze({ advantageWords, disadvantageWords, ratio }),
    }),
  ]);
}

function executeCommercialRepetition(
  context: CommercialRuleExecutionContext,
): readonly EditorialFindingInput[] {
  const patterns = context.profile.promotionalLanguagePatterns ?? [];
  const maxRepetition = context.profile.prosConsThresholds?.maxCommercialRepetitionCount;
  if (patterns.length === 0 || !maxRepetition) {
    return Object.freeze([]);
  }

  const findings: EditorialFindingInput[] = [];
  for (const section of context.sections) {
    const repetitionCount = countPatternMatches(section.body, patterns);
    if (repetitionCount <= maxRepetition) {
      continue;
    }

    findings.push(
      Object.freeze({
        id: `repetition:${section.id}:commercial`,
        category: 'commercial',
        code: 'commercial-repetition',
        analyzerId: 'neutrality',
        checkId: 'affiliate-compliance',
        severity: 'low',
        confidence: 'high',
        reason: `Section "${section.heading?.text ?? section.id}" repeats commercial phrasing excessively.`,
        recommendation:
          'Reduce repeated commercial phrasing to keep the review neutral and trustworthy.',
        acceptanceCriteria:
          'Commercial phrase repetition in the section stays within configured limits.',
        location: Object.freeze({
          sectionId: section.id,
          headingText: section.heading?.text,
        }),
        metadata: Object.freeze({ repetitionCount, maxRepetition }),
      }),
    );
  }

  return Object.freeze(findings);
}

export const COMMERCIAL_RULE_EXECUTORS: Readonly<
  Record<CommercialRuleCode, CommercialRuleExecutor>
> = Object.freeze({
  'affiliate-disclosure-missing': executeAffiliateDisclosureMissing,
  'affiliate-disclosure-misplaced': executeAffiliateDisclosureMisplaced,
  'affiliate-disclosure-duplicate': executeAffiliateDisclosureDuplicate,
  'commercial-relationship-not-disclosed': executeCommercialRelationshipNotDisclosed,
  'single-product-bias': executeSingleProductBias,
  'missing-alternatives': executeMissingAlternatives,
  'missing-disadvantages': executeMissingDisadvantages,
  'missing-advantages': executeMissingAdvantages,
  'missing-comparison-opportunity': executeMissingComparisonOpportunity,
  'unsupported-purchase-recommendation': executeUnsupportedPurchaseRecommendation,
  'overly-promotional-language': executeOverlyPromotionalLanguage,
  'commercial-call-to-action-imbalance': executeCommercialCallToActionImbalance,
  'price-mention-without-context': executePriceMentionWithoutContext,
  'availability-claim-without-qualification': executeAvailabilityClaimWithoutQualification,
  'sponsored-wording-indicator': executeSponsoredWordingIndicator,
  'missing-neutrality-statement': executeMissingNeutralityStatement,
  'missing-product-suitability-section': executeMissingProductSuitabilitySection,
  'missing-who-should-avoid-guidance': executeMissingWhoShouldAvoidGuidance,
  'missing-decision-support-information': executeMissingDecisionSupportInformation,
  'imbalanced-pros-cons-ratio': executeImbalancedProsConsRatio,
  'commercial-repetition': executeCommercialRepetition,
});

/** Build execution context for commercial rules from markdown content and profile. */
export function createCommercialRuleExecutionContext(
  content: string,
  profile: CommercialAnalyzerProfile,
): CommercialRuleExecutionContext {
  return Object.freeze({
    content,
    profile,
    sections: extractMarkdownSections(content),
  });
}
