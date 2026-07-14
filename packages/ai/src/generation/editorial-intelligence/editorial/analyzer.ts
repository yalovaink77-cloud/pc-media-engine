import type { EditorialAnalyzerProfile, EditorialFindingInput, EditorialRule } from '@pcme/shared';

import { normalizeEditorialFindingInput } from '../finding/validate.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { dedupeAndSortEditorialFindings } from './dedupe.js';
import { createDefaultEditorialRuleRegistry } from './rule-registry.js';
import {
  createEditorialRuleExecutionContext,
  EDITORIAL_RULE_EXECUTORS,
  type EditorialRuleCode,
} from './rules.js';
import type { EditorialAnalysisInput, EditorialAnalysisResult } from './types.js';

export interface EditorialAnalyzerOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
}

function resolveAnalyzerProfile(profile?: EditorialAnalyzerProfile): EditorialAnalyzerProfile {
  return Object.freeze(profile ?? {});
}

function isEditorialRuleCode(code: string): code is EditorialRuleCode {
  return code in EDITORIAL_RULE_EXECUTORS;
}

/** Deterministic editorial analyzer that executes enabled registry rules without mutating content. */
export class EditorialAnalyzer {
  private readonly ruleRegistry: EditorialRuleRegistry;

  constructor(options: EditorialAnalyzerOptions = {}) {
    this.ruleRegistry = options.ruleRegistry ?? createDefaultEditorialRuleRegistry();
  }

  analyze(
    input: EditorialAnalysisInput,
    profile?: EditorialAnalyzerProfile,
  ): EditorialAnalysisResult {
    const analyzerProfile = resolveAnalyzerProfile(profile);
    const context = createEditorialRuleExecutionContext(input.content, analyzerProfile);
    const enabledRules = this.ruleRegistry.resolveEnabled({ category: 'editorial' });
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
    context: ReturnType<typeof createEditorialRuleExecutionContext>,
  ): readonly EditorialFindingInput[] {
    if (!isEditorialRuleCode(rule.code)) {
      return Object.freeze([]);
    }

    const executor = EDITORIAL_RULE_EXECUTORS[rule.code];
    return executor(context);
  }
}
