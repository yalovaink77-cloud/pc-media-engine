import type { EditorialFindingInput } from '@pcme/shared';
import type { EditorialRule, EvidenceAnalyzerProfile } from '@pcme/shared';

import { dedupeAndSortEditorialFindings } from '../editorial/dedupe.js';
import { normalizeEditorialFindingInput } from '../finding/validate.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { createDefaultEvidenceRuleRegistry } from './rule-registry.js';
import {
  createEvidenceRuleExecutionContext,
  EVIDENCE_RULE_EXECUTORS,
  type EvidenceRuleCode,
} from './rules.js';
import type { EvidenceAnalysisInput, EvidenceAnalysisResult } from './types.js';

export interface EvidenceAnalyzerOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
}

function resolveAnalyzerProfile(profile?: EvidenceAnalyzerProfile): EvidenceAnalyzerProfile {
  return Object.freeze(profile ?? {});
}

function isEvidenceRuleCode(code: string): code is EvidenceRuleCode {
  return code in EVIDENCE_RULE_EXECUTORS;
}

/** Deterministic evidence analyzer that evaluates traceability without verifying truthfulness. */
export class EvidenceAnalyzer {
  private readonly ruleRegistry: EditorialRuleRegistry;

  constructor(options: EvidenceAnalyzerOptions = {}) {
    this.ruleRegistry = options.ruleRegistry ?? createDefaultEvidenceRuleRegistry();
  }

  analyze(input: EvidenceAnalysisInput, profile?: EvidenceAnalyzerProfile): EvidenceAnalysisResult {
    const analyzerProfile = resolveAnalyzerProfile(profile);
    const context = createEvidenceRuleExecutionContext(input.content, analyzerProfile);
    const enabledRules = this.ruleRegistry.resolveEnabled({ category: 'evidence' });
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
    context: ReturnType<typeof createEvidenceRuleExecutionContext>,
  ): readonly EditorialFindingInput[] {
    if (!isEvidenceRuleCode(rule.code)) {
      return Object.freeze([]);
    }

    return EVIDENCE_RULE_EXECUTORS[rule.code](context);
  }
}
