import type { EditorialIntelligenceProfile } from '@pcme/shared';

import type { EditorialModule, EditorialModuleAnalysisInput } from '../module.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { AiSeoAnalyzer } from './analyzer.js';
import { createDefaultAiSeoRuleRegistry } from './rule-registry.js';

export interface AiSeoAnalyzerModuleOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
  readonly analyzer?: AiSeoAnalyzer;
}

function resolveAnalyzerProfile(profile: EditorialIntelligenceProfile) {
  return profile.aiSeoAnalyzer ?? Object.freeze({});
}

/** Create the AI SEO intelligence module backed by the deterministic AI SEO analyzer. */
export function createAiSeoAnalyzerModule(
  options: AiSeoAnalyzerModuleOptions = {},
): EditorialModule {
  const ruleRegistry = options.ruleRegistry ?? createDefaultAiSeoRuleRegistry();
  const analyzer = options.analyzer ?? new AiSeoAnalyzer({ ruleRegistry });

  return Object.freeze({
    moduleId: 'ai-seo',
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
