import type { EditorialIntelligenceProfile } from '@pcme/shared';

import type { EditorialModule, EditorialModuleAnalysisInput } from '../module.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { CommercialAnalyzer } from './analyzer.js';
import { createDefaultCommercialRuleRegistry } from './rule-registry.js';

export interface CommercialAnalyzerModuleOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
  readonly analyzer?: CommercialAnalyzer;
}

function resolveAnalyzerProfile(profile: EditorialIntelligenceProfile) {
  return profile.commercialAnalyzer ?? Object.freeze({});
}

/** Create the commercial intelligence module backed by the deterministic commercial analyzer. */
export function createCommercialAnalyzerModule(
  options: CommercialAnalyzerModuleOptions = {},
): EditorialModule {
  const ruleRegistry = options.ruleRegistry ?? createDefaultCommercialRuleRegistry();
  const analyzer = options.analyzer ?? new CommercialAnalyzer({ ruleRegistry });

  return Object.freeze({
    moduleId: 'commercial',
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
