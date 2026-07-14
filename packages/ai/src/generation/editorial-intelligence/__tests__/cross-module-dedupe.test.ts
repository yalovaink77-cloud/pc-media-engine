import type { EditorialFindingInput } from '@pcme/shared';
import { describe, expect, it } from 'vitest';

import { dedupeCrossModuleFindings } from '../cross-module-dedupe.js';

function finding(
  overrides: Partial<EditorialFindingInput> & Pick<EditorialFindingInput, 'category' | 'code'>,
): EditorialFindingInput {
  return Object.freeze({
    id: overrides.id ?? `${overrides.category}:${overrides.code}`,
    analyzerId: overrides.analyzerId ?? 'test',
    checkId: overrides.checkId ?? 'publication-readiness',
    severity: overrides.severity ?? 'medium',
    confidence: overrides.confidence ?? 'high',
    reason: overrides.reason ?? 'test reason',
    recommendation: overrides.recommendation ?? 'test recommendation',
    acceptanceCriteria: overrides.acceptanceCriteria ?? 'test acceptance',
    location: overrides.location,
    metadata: overrides.metadata,
    ...overrides,
  });
}

describe('dedupeCrossModuleFindings', () => {
  it('keeps a single finding unchanged', () => {
    const findings = Object.freeze([
      finding({ category: 'seo', code: 'missing-h1', id: 'heading:missing-h1' }),
    ]);
    expect(dedupeCrossModuleFindings(findings)).toEqual(findings);
  });

  it('prefers ai-seo for indirect FAQ answers at the same location', () => {
    const location = Object.freeze({
      sectionId: 'faq',
      lineRange: Object.freeze({ start: 10, end: 11 }),
    });
    const findings = Object.freeze([
      finding({
        category: 'seo',
        code: 'indirect-faq-answer',
        id: 'faq:indirect:consult:how-often',
        location,
        recommendation: 'SEO recommendation',
      }),
      finding({
        category: 'ai-seo',
        code: 'indirect-faq-answer',
        id: 'faq:indirect:consult:how-often',
        location,
        recommendation: 'AI SEO recommendation',
      }),
    ]);

    const deduped = dedupeCrossModuleFindings(findings);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.category).toBe('ai-seo');
    expect(deduped[0]?.recommendation).toBe('AI SEO recommendation');
  });

  it('prefers evidence for unresolved source placeholders', () => {
    const location = Object.freeze({
      sectionId: 'body',
      lineRange: Object.freeze({ start: 5, end: 5 }),
    });
    const findings = Object.freeze([
      finding({
        category: 'ai-seo',
        code: 'unresolved-source-placeholder',
        id: 'source:unresolved',
        location,
      }),
      finding({
        category: 'evidence',
        code: 'unresolved-source-placeholder',
        id: 'source:unresolved',
        location,
      }),
    ]);

    const deduped = dedupeCrossModuleFindings(findings);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.category).toBe('evidence');
  });

  it('prefers commercial for promotional tone overlap at the same section', () => {
    const location = Object.freeze({ sectionId: 'overview' });
    const findings = Object.freeze([
      finding({
        category: 'editorial',
        code: 'promotional-tone',
        id: 'tone:promotional:overview',
        location,
      }),
      finding({
        category: 'commercial',
        code: 'overly-promotional-language',
        id: 'promotion:overview:excessive',
        location,
      }),
    ]);

    const deduped = dedupeCrossModuleFindings(findings);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.category).toBe('commercial');
  });

  it('retains findings with different codes at the same section', () => {
    const location = Object.freeze({ sectionId: 'overview' });
    const findings = Object.freeze([
      finding({
        category: 'seo',
        code: 'weak-title-keyword-coverage',
        id: 'title:weak',
        location,
      }),
      finding({
        category: 'ai-seo',
        code: 'low-factual-density',
        id: 'density:overview:low',
        location,
      }),
    ]);

    expect(dedupeCrossModuleFindings(findings)).toHaveLength(2);
  });
});
