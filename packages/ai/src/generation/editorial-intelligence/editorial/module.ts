import type { EditorialIntelligenceProfile } from '@pcme/shared';

import type { EditorialModule } from '../module.js';
import type { EditorialModuleAnalysisInput } from '../module.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { EditorialAnalyzer } from './analyzer.js';
import { createDefaultEditorialRuleRegistry } from './rule-registry.js';

export interface EditorialAnalyzerModuleOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
  readonly analyzer?: EditorialAnalyzer;
}

function resolveAnalyzerProfile(profile: EditorialIntelligenceProfile) {
  return profile.editorialAnalyzer ?? Object.freeze({});
}

/** Create the editorial intelligence module backed by the deterministic editorial analyzer. */
export function createEditorialAnalyzerModule(
  options: EditorialAnalyzerModuleOptions = {},
): EditorialModule {
  const ruleRegistry = options.ruleRegistry ?? createDefaultEditorialRuleRegistry();
  const analyzer = options.analyzer ?? new EditorialAnalyzer({ ruleRegistry });

  return Object.freeze({
    moduleId: 'editorial',
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
