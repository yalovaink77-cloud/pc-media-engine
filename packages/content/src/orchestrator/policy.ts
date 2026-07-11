import type { KnowledgeContextResult } from '../knowledge/context/types.js';
import { containsBlockedPromptMetadata } from '../prompt/serialize.js';
import type { PromptPayloadResult } from '../prompt/types.js';
import type { ContentGenerationWarning } from './types.js';

const AGGRESSIVE_AFFILIATE_CTAS = new Set([
  'commission-first',
  'buy-now-urgency',
  'hidden-affiliate',
  'rank-by-commission',
]);

const SAFETY_FIRST_CONTENT_TYPES = new Set(['problem-guide', 'aftercare-guide']);

export function checkDraftEntityWarnings(
  context: KnowledgeContextResult,
): ContentGenerationWarning[] {
  const warnings: ContentGenerationWarning[] = [];

  for (const nodes of Object.values(context.entitiesByType)) {
    for (const node of nodes ?? []) {
      const review = node.fields?.review;
      const reviewStatus =
        typeof review === 'object' &&
        review !== null &&
        'status' in review &&
        typeof (review as { status?: unknown }).status === 'string'
          ? (review as { status: string }).status
          : undefined;
      const status = typeof node.fields?.status === 'string' ? node.fields.status : reviewStatus;

      if (status === 'draft') {
        warnings.push(
          Object.freeze({
            code: 'draft-knowledge-entity',
            message: `Knowledge entity is marked draft: ${node.type}:${node.id}`,
            source: 'orchestrator',
            severity: 'warning',
          }),
        );
      }
    }
  }

  return warnings;
}

export function checkMissingSourceNotesWarnings(
  context: KnowledgeContextResult,
): ContentGenerationWarning[] {
  const hasSourceNotes = Object.values(context.entitiesByType).some((nodes) =>
    (nodes ?? []).some((node) => {
      const sources = node.fields?.sources ?? node.fields?.source_notes;
      return Array.isArray(sources) ? sources.length > 0 : typeof sources === 'string';
    }),
  );

  if (!hasSourceNotes) {
    return [
      Object.freeze({
        code: 'missing-source-notes',
        message: 'No source notes found in supplied knowledge context',
        source: 'orchestrator',
        severity: 'warning',
      }),
    ];
  }

  return [];
}

export function checkStaleReviewWarnings(
  context: KnowledgeContextResult,
): ContentGenerationWarning[] {
  const warnings: ContentGenerationWarning[] = [];

  for (const nodes of Object.values(context.entitiesByType)) {
    for (const node of nodes ?? []) {
      const review = node.fields?.review;
      if (
        typeof review === 'object' &&
        review !== null &&
        'last_reviewed' in review &&
        typeof (review as { last_reviewed?: unknown }).last_reviewed === 'string'
      ) {
        const lastReviewed = (review as { last_reviewed: string }).last_reviewed;
        const reviewedAt = Date.parse(lastReviewed);
        if (!Number.isNaN(reviewedAt)) {
          const ageMs = Date.now() - reviewedAt;
          const oneYearMs = 365 * 24 * 60 * 60 * 1000;
          if (ageMs > oneYearMs) {
            warnings.push(
              Object.freeze({
                code: 'stale-review-date',
                message: `Knowledge entity review date may be stale: ${node.type}:${node.id}`,
                source: 'orchestrator',
                severity: 'warning',
              }),
            );
          }
        }
      }
    }
  }

  return warnings;
}

export function checkProblemGuideAffiliatePolicy(
  contentType: string,
  payload: PromptPayloadResult,
): ContentGenerationWarning[] {
  if (contentType !== 'problem-guide') {
    return [];
  }

  const violations = payload.outputContract.allowedCtaTypes.filter((cta) =>
    AGGRESSIVE_AFFILIATE_CTAS.has(cta),
  );

  if (violations.length > 0) {
    return [
      Object.freeze({
        code: 'unsafe-recipe-policy',
        message: `Problem guide allows aggressive affiliate CTAs: ${violations.join(', ')}`,
        source: 'orchestrator',
        severity: 'warning',
      }),
    ];
  }

  return [];
}

export function isUnsafeRecipePolicy(contentType: string, payload: PromptPayloadResult): boolean {
  if (contentType === 'problem-guide') {
    return payload.outputContract.allowedCtaTypes.some((cta) => AGGRESSIVE_AFFILIATE_CTAS.has(cta));
  }

  return false;
}

export function checkSafetyFirstConstraints(
  contentType: string,
  payload: PromptPayloadResult,
): ContentGenerationWarning[] {
  if (!SAFETY_FIRST_CONTENT_TYPES.has(contentType)) {
    return [];
  }

  const hasSafetyConstraints = payload.constraints.some(
    (constraint) =>
      constraint.category === 'medical' ||
      constraint.id === 'no-diagnosis' ||
      constraint.id === 'no-unsupported-medical-claims',
  );

  if (!hasSafetyConstraints) {
    return [
      Object.freeze({
        code: 'missing-safety-constraints',
        message: `${contentType} is missing required safety-first constraints`,
        source: 'orchestrator',
        severity: 'warning',
      }),
    ];
  }

  return [];
}

export function checkBlockedMetadataLeakage(payload: PromptPayloadResult): boolean {
  const serialized = JSON.stringify(payload);
  if (serialized.includes('sourcePath') || serialized.includes('template_path')) {
    return true;
  }

  return payload.userSections.some((section) => containsBlockedPromptMetadata(section.content));
}

export function checkSafetyFirstPolicyBlock(
  contentType: string,
  payload: PromptPayloadResult,
): boolean {
  if (!SAFETY_FIRST_CONTENT_TYPES.has(contentType)) {
    return false;
  }

  return !payload.constraints.some(
    (constraint) =>
      constraint.id === 'no-diagnosis' || constraint.id === 'no-unsupported-medical-claims',
  );
}
