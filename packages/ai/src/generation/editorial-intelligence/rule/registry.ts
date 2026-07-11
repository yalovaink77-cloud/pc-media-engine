import type {
  EditorialRule,
  EditorialRuleId,
  EditorialRuleInput,
  FindingCategory,
  RuleGroup,
} from '@pcme/shared';

import { normalizeEditorialRuleInput, validateEditorialRule } from './validate.js';

function compareRules(left: EditorialRule, right: EditorialRule): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  if (left.category !== right.category) {
    return left.category.localeCompare(right.category);
  }

  return left.code.localeCompare(right.code);
}

function sortRules(rules: readonly EditorialRule[]): readonly EditorialRule[] {
  return Object.freeze([...rules].sort(compareRules));
}

function toValidatedRule(rule: EditorialRule | EditorialRuleInput): EditorialRule {
  return 'enabled' in rule && typeof rule.enabled === 'boolean'
    ? validateEditorialRule(rule)
    : normalizeEditorialRuleInput(rule);
}

/** Registry of intelligence rules keyed by stable rule identifier. */
export class EditorialRuleRegistry {
  private readonly rules = new Map<EditorialRuleId, EditorialRule>();

  constructor(rules: readonly (EditorialRule | EditorialRuleInput)[] = []) {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  register(rule: EditorialRule | EditorialRuleInput): void {
    const validated = toValidatedRule(rule);
    if (this.rules.has(validated.id)) {
      throw new Error(`Editorial rule already registered: ${validated.id}`);
    }

    const duplicateCode = [...this.rules.values()].find(
      (existing) => existing.category === validated.category && existing.code === validated.code,
    );
    if (duplicateCode) {
      throw new Error(
        `Editorial rule code already registered for category ${validated.category}: ${validated.code}`,
      );
    }

    this.rules.set(validated.id, validated);
  }

  get(ruleId: EditorialRuleId): EditorialRule | undefined {
    return this.rules.get(ruleId);
  }

  getByCode(category: FindingCategory, code: string): EditorialRule | undefined {
    return [...this.rules.values()].find(
      (rule) => rule.category === category && rule.code === code,
    );
  }

  has(ruleId: EditorialRuleId): boolean {
    return this.rules.has(ruleId);
  }

  size(): number {
    return this.rules.size;
  }

  list(): readonly EditorialRule[] {
    return sortRules([...this.rules.values()]);
  }

  listByCategory(category: FindingCategory): readonly EditorialRule[] {
    return sortRules([...this.rules.values()].filter((rule) => rule.category === category));
  }

  listByGroup(group: RuleGroup): readonly EditorialRule[] {
    return sortRules([...this.rules.values()].filter((rule) => rule.group === group));
  }

  listEnabled(): readonly EditorialRule[] {
    return sortRules([...this.rules.values()].filter((rule) => rule.enabled));
  }

  listEnabledByCategory(category: FindingCategory): readonly EditorialRule[] {
    return sortRules(
      [...this.rules.values()].filter((rule) => rule.enabled && rule.category === category),
    );
  }

  listEnabledByGroup(group: RuleGroup): readonly EditorialRule[] {
    return sortRules(
      [...this.rules.values()].filter((rule) => rule.enabled && rule.group === group),
    );
  }

  resolveEnabled(options?: {
    readonly category?: FindingCategory;
    readonly group?: RuleGroup;
  }): readonly EditorialRule[] {
    let rules = [...this.rules.values()].filter((rule) => rule.enabled);

    if (options?.category) {
      rules = rules.filter((rule) => rule.category === options.category);
    }

    if (options?.group) {
      rules = rules.filter((rule) => rule.group === options.group);
    }

    return sortRules(rules);
  }

  enable(ruleId: EditorialRuleId): EditorialRule {
    return this.setEnabled(ruleId, true);
  }

  disable(ruleId: EditorialRuleId): EditorialRule {
    return this.setEnabled(ruleId, false);
  }

  setEnabled(ruleId: EditorialRuleId, enabled: boolean): EditorialRule {
    const existing = this.rules.get(ruleId);
    if (!existing) {
      throw new Error(`Editorial rule not registered: ${ruleId}`);
    }

    const updated = Object.freeze({ ...existing, enabled });
    this.rules.set(ruleId, updated);
    return updated;
  }
}
