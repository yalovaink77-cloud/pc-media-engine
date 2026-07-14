import type { CommercialAnalyzerProfile, EditorialFindingInput, EditorialRule } from '@pcme/shared';

import { dedupeAndSortEditorialFindings } from '../editorial/dedupe.js';
import { normalizeEditorialFindingInput } from '../finding/validate.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { createDefaultCommercialRuleRegistry } from './rule-registry.js';
import {
  COMMERCIAL_RULE_EXECUTORS,
  type CommercialRuleCode,
  createCommercialRuleExecutionContext,
} from './rules.js';
import type { CommercialAnalysisInput, CommercialAnalysisResult } from './types.js';

export interface CommercialAnalyzerOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
}

function resolveAnalyzerProfile(profile?: CommercialAnalyzerProfile): CommercialAnalyzerProfile {
  return Object.freeze(profile ?? {});
}

function isCommercialRuleCode(code: string): code is CommercialRuleCode {
  return code in COMMERCIAL_RULE_EXECUTORS;
}

/**
 * Deterministic commercial analyzer that evaluates publication trust and neutrality.
 * It never optimizes for sales, conversions, or affiliate revenue.
 */
export class CommercialAnalyzer {
  private readonly ruleRegistry: EditorialRuleRegistry;

  constructor(options: CommercialAnalyzerOptions = {}) {
    this.ruleRegistry = options.ruleRegistry ?? createDefaultCommercialRuleRegistry();
  }

  analyze(
    input: CommercialAnalysisInput,
    profile?: CommercialAnalyzerProfile,
  ): CommercialAnalysisResult {
    const analyzerProfile = resolveAnalyzerProfile(profile);
    const context = createCommercialRuleExecutionContext(input.content, analyzerProfile);
    const enabledRules = this.ruleRegistry.resolveEnabled({ category: 'commercial' });
    const findings: EditorialFindingInput[] = [];

    for (const rule of enabledRules) {
      findings.push(...this.executeRule(rule, context));
    }

    const normalized = findings.map((finding) => normalizeEditorialFindingInput(finding));

    return Object.freeze({
      findings: dedupeAndSortEditorialFindings(normalized),
    });
  }

  private executeRule(
    rule: EditorialRule,
    context: ReturnType<typeof createCommercialRuleExecutionContext>,
  ): readonly EditorialFindingInput[] {
    if (!isCommercialRuleCode(rule.code)) {
      return Object.freeze([]);
    }

    return COMMERCIAL_RULE_EXECUTORS[rule.code](context);
  }
}
