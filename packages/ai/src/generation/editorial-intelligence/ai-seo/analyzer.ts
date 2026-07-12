import type { AiSeoAnalyzerProfile, EditorialFindingInput, EditorialRule } from '@pcme/shared';

import { dedupeAndSortEditorialFindings } from '../editorial/dedupe.js';
import { normalizeEditorialFindingInput } from '../finding/validate.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { createDefaultAiSeoRuleRegistry } from './rule-registry.js';
import {
  AI_SEO_RULE_EXECUTORS,
  type AiSeoRuleCode,
  createAiSeoRuleExecutionContext,
} from './rules.js';
import type { AiSeoAnalysisInput, AiSeoAnalysisResult } from './types.js';

export interface AiSeoAnalyzerOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
}

function resolveAnalyzerProfile(profile?: AiSeoAnalyzerProfile): AiSeoAnalyzerProfile {
  return Object.freeze(profile ?? {});
}

function isAiSeoRuleCode(code: string): code is AiSeoRuleCode {
  return code in AI_SEO_RULE_EXECUTORS;
}

/**
 * Deterministic AI SEO analyzer for machine retrieval and answer synthesis readiness.
 * Does not predict rankings, citations, or inclusion in any AI search product.
 */
export class AiSeoAnalyzer {
  private readonly ruleRegistry: EditorialRuleRegistry;

  constructor(options: AiSeoAnalyzerOptions = {}) {
    this.ruleRegistry = options.ruleRegistry ?? createDefaultAiSeoRuleRegistry();
  }

  analyze(input: AiSeoAnalysisInput, profile?: AiSeoAnalyzerProfile): AiSeoAnalysisResult {
    const analyzerProfile = resolveAnalyzerProfile(profile);
    const context = createAiSeoRuleExecutionContext(input.content, analyzerProfile);
    const enabledRules = this.ruleRegistry.resolveEnabled({ category: 'ai-seo' });
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
    context: ReturnType<typeof createAiSeoRuleExecutionContext>,
  ): readonly EditorialFindingInput[] {
    if (!isAiSeoRuleCode(rule.code)) {
      return Object.freeze([]);
    }

    return AI_SEO_RULE_EXECUTORS[rule.code](context);
  }
}
