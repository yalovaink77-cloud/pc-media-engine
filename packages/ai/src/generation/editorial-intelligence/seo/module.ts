import type { EditorialIntelligenceProfile } from '@pcme/shared';

import type { EditorialModule, EditorialModuleAnalysisInput } from '../module.js';
import type { EditorialRuleRegistry } from '../rule/registry.js';
import { SeoAnalyzer } from './analyzer.js';
import { createDefaultSeoRuleRegistry } from './rule-registry.js';

export interface SeoAnalyzerModuleOptions {
  readonly ruleRegistry?: EditorialRuleRegistry;
  readonly analyzer?: SeoAnalyzer;
}

function resolveAnalyzerProfile(profile: EditorialIntelligenceProfile) {
  return profile.seoAnalyzer ?? Object.freeze({});
}

/** Create the SEO intelligence module backed by the deterministic SEO analyzer. */
export function createSeoAnalyzerModule(options: SeoAnalyzerModuleOptions = {}): EditorialModule {
  const ruleRegistry = options.ruleRegistry ?? createDefaultSeoRuleRegistry();
  const analyzer = options.analyzer ?? new SeoAnalyzer({ ruleRegistry });

  return Object.freeze({
    moduleId: 'seo',
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
