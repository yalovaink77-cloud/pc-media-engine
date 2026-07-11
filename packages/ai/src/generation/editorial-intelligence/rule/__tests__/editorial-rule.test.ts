import { EditorialRuleValidationError } from '@pcme/shared';
import { describe, expect, it } from 'vitest';

import {
  buildDeterministicEditorialRuleId,
  EditorialRuleRegistry,
  normalizeEditorialRuleInput,
  parseEditorialRule,
  parseEditorialRules,
  serializeEditorialRule,
  serializeEditorialRules,
  validateEditorialRule,
} from '../index.js';

const RULE_METADATA = Object.freeze({
  title: 'Long sentence limit',
  description: 'Flags sentences that exceed the configured readability threshold.',
  tags: Object.freeze(['readability']),
});

const VALID_RULE_INPUT = Object.freeze({
  category: 'editorial' as const,
  code: 'long-sentence',
  analyzerId: 'readability',
  group: 'readability-quality',
  priority: 10,
  metadata: RULE_METADATA,
});

function createRule(overrides: Partial<Parameters<typeof normalizeEditorialRuleInput>[0]> = {}) {
  const scopeId = 'generic-product-review-v1';
  const id = buildDeterministicEditorialRuleId({
    scopeId,
    category: overrides.category ?? VALID_RULE_INPUT.category,
    analyzerId: overrides.analyzerId ?? VALID_RULE_INPUT.analyzerId,
    code: overrides.code ?? VALID_RULE_INPUT.code,
  });

  return normalizeEditorialRuleInput({
    ...VALID_RULE_INPUT,
    id,
    ...overrides,
  });
}

describe('buildDeterministicEditorialRuleId', () => {
  it('returns a stable 32-character identifier', () => {
    const input = Object.freeze({
      scopeId: 'generic-product-review-v1',
      category: 'editorial' as const,
      analyzerId: 'readability',
      code: 'long-sentence',
    });

    expect(buildDeterministicEditorialRuleId(input)).toBe(buildDeterministicEditorialRuleId(input));
    expect(buildDeterministicEditorialRuleId(input)).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('normalizeEditorialRuleInput', () => {
  it('defaults enabled to true', () => {
    const rule = normalizeEditorialRuleInput(VALID_RULE_INPUT);

    expect(rule.enabled).toBe(true);
    expect(rule.group).toBe('readability-quality');
    expect(rule.metadata.title).toBe(RULE_METADATA.title);
  });

  it('rejects invalid rule codes', () => {
    expect(() =>
      normalizeEditorialRuleInput({
        ...VALID_RULE_INPUT,
        code: 'Invalid_Code',
      }),
    ).toThrow(EditorialRuleValidationError);
  });

  it('rejects invalid groups', () => {
    expect(() =>
      normalizeEditorialRuleInput({
        ...VALID_RULE_INPUT,
        group: 'Invalid Group',
      }),
    ).toThrow(EditorialRuleValidationError);
  });

  it('rejects negative priority values', () => {
    expect(() =>
      normalizeEditorialRuleInput({
        ...VALID_RULE_INPUT,
        priority: -1,
      }),
    ).toThrow(EditorialRuleValidationError);
  });
});

describe('validateEditorialRule', () => {
  it('validates a normalized rule with deterministic id requirement', () => {
    const rule = createRule({ category: 'evidence', code: 'missing-citation' });

    const validated = validateEditorialRule(rule, { requireDeterministicId: true });

    expect(validated.id).toBe(rule.id);
    expect(validated.category).toBe('evidence');
  });
});

describe('serializeEditorialRule', () => {
  it('round-trips a rule through JSON', () => {
    const rule = createRule({ category: 'seo', code: 'missing-meta-description' });

    const serialized = serializeEditorialRule(rule);
    const parsed = parseEditorialRule(serialized);

    expect(parsed).toEqual(rule);
    expect(serialized.endsWith('\n')).toBe(true);
  });
});

describe('serializeEditorialRules', () => {
  it('round-trips a rule list through JSON', () => {
    const rules = [
      createRule({ category: 'knowledge', code: 'unsupported-claim' }),
      createRule({
        category: 'affiliate',
        analyzerId: 'disclosure',
        code: 'disclosure-unresolved',
        group: 'affiliate-compliance',
        priority: 5,
      }),
    ];

    const serialized = serializeEditorialRules(rules);
    const parsed = parseEditorialRules(serialized);

    expect(parsed).toHaveLength(2);
    expect(parsed.map((rule) => rule.code)).toEqual(['unsupported-claim', 'disclosure-unresolved']);
  });
});

describe('EditorialRuleRegistry', () => {
  it('lists rules sorted by priority then code', () => {
    const registry = new EditorialRuleRegistry([
      createRule({ code: 'long-sentence', priority: 20 }),
      createRule({
        category: 'evidence',
        analyzerId: 'citation-readiness',
        code: 'missing-citation',
        group: 'citation-quality',
        priority: 5,
      }),
    ]);

    expect(registry.list().map((rule) => rule.code)).toEqual(['missing-citation', 'long-sentence']);
  });

  it('groups rules by category and group', () => {
    const registry = new EditorialRuleRegistry([
      createRule({ code: 'long-sentence', group: 'readability-quality' }),
      createRule({
        category: 'seo',
        analyzerId: 'metadata',
        code: 'missing-meta-description',
        group: 'metadata-quality',
      }),
    ]);

    expect(registry.listByCategory('seo')).toHaveLength(1);
    expect(registry.listByGroup('readability-quality')[0]?.code).toBe('long-sentence');
  });

  it('supports enable and disable operations', () => {
    const rule = createRule();
    const registry = new EditorialRuleRegistry([rule]);

    expect(registry.listEnabled()).toHaveLength(1);

    const disabled = registry.disable(rule.id);
    expect(disabled.enabled).toBe(false);
    expect(registry.listEnabled()).toHaveLength(0);
    expect(registry.resolveEnabled()).toHaveLength(0);

    const enabled = registry.enable(rule.id);
    expect(enabled.enabled).toBe(true);
    expect(registry.resolveEnabled({ category: 'editorial' })).toHaveLength(1);
  });

  it('rejects duplicate rule registration', () => {
    const rule = createRule();
    const registry = new EditorialRuleRegistry([rule]);

    expect(() => registry.register(rule)).toThrow(/already registered/i);
  });

  it('rejects duplicate category and code pairs', () => {
    const registry = new EditorialRuleRegistry([createRule()]);
    const duplicateCodeRule = createRule({
      id: buildDeterministicEditorialRuleId({
        scopeId: 'other-scope',
        category: 'editorial',
        analyzerId: 'readability',
        code: 'long-sentence',
      }),
    });

    expect(() => registry.register(duplicateCodeRule)).toThrow(/already registered for category/i);
  });

  it('throws when enabling an unknown rule', () => {
    const registry = new EditorialRuleRegistry();

    expect(() => registry.enable('missing-rule-id')).toThrow(/not registered/i);
  });
});
