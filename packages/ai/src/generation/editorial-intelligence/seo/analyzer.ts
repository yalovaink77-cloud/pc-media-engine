import type { EditorialFindingInput, EditorialRule, SeoAnalyzerProfile } from '@pcme/shared';

import { dedupeAndSortEditorialFindings } from '../editorial/dedupe.js';
import { normalizeEditorialFindingInput } from '../finding/validate.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { createDefaultSeoRuleRegistry } from './rule-registry.js';
import { createSeoRuleExecutionContext, SEO_RULE_EXECUTORS, type SeoRuleCode } from './rules.js';
import type { SeoAnalysisInput, SeoAnalysisResult } from './types.js';

export interface SeoAnalyzerOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
}

function resolveAnalyzerProfile(profile?: SeoAnalyzerProfile): SeoAnalyzerProfile {
  return Object.freeze(profile ?? {});
}

function isSeoRuleCode(code: string): code is SeoRuleCode {
  return code in SEO_RULE_EXECUTORS;
}

/** Deterministic SEO analyzer for classic on-page SEO checks. */
export class SeoAnalyzer {
  private readonly ruleRegistry: EditorialRuleRegistry;

  constructor(options: SeoAnalyzerOptions = {}) {
    this.ruleRegistry = options.ruleRegistry ?? createDefaultSeoRuleRegistry();
  }

  analyze(input: SeoAnalysisInput, profile?: SeoAnalyzerProfile): SeoAnalysisResult {
    const analyzerProfile = resolveAnalyzerProfile(profile);
    const context = createSeoRuleExecutionContext(input.content, analyzerProfile);
    const enabledRules = this.ruleRegistry.resolveEnabled({ category: 'seo' });
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
    context: ReturnType<typeof createSeoRuleExecutionContext>,
  ): readonly EditorialFindingInput[] {
    if (!isSeoRuleCode(rule.code)) {
      return Object.freeze([]);
    }

    return SEO_RULE_EXECUTORS[rule.code](context);
  }
}
