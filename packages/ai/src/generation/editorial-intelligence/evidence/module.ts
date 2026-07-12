import type { EditorialIntelligenceProfile } from '@pcme/shared';

import type { EditorialModule, EditorialModuleAnalysisInput } from '../module.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { EvidenceAnalyzer } from './analyzer.js';
import { createDefaultEvidenceRuleRegistry } from './rule-registry.js';

export interface EvidenceAnalyzerModuleOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
  readonly analyzer?: EvidenceAnalyzer;
}

function resolveAnalyzerProfile(profile: EditorialIntelligenceProfile) {
  return profile.evidenceAnalyzer ?? Object.freeze({});
}

/** Create the evidence intelligence module backed by the deterministic evidence analyzer. */
export function createEvidenceAnalyzerModule(
  options: EvidenceAnalyzerModuleOptions = {},
): EditorialModule {
  const ruleRegistry = options.ruleRegistry ?? createDefaultEvidenceRuleRegistry();
  const analyzer = options.analyzer ?? new EvidenceAnalyzer({ ruleRegistry });

  return Object.freeze({
    moduleId: 'evidence',
    analyze(input: EditorialModuleAnalysisInput) {
      const result = analyzer.analyze(
        Object.freeze({
          content: input.artifact.content,
          reportId: input.reportId,
          artifactId: input.artifact.artifactId,
        }),
        resolveAnalyzerProfile(input.profile),
      );

      return result.findings;
    },
  });
}
