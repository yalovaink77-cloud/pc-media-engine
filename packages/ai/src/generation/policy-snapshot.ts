import type { ContentGenerationPlan } from '@pcme/content';

import type { GenerationPolicySnapshot } from './types.js';

export const DEFAULT_BLOCKED_JOB_FIELDS = Object.freeze([
  'template_path',
  'sourcePath',
  'source_path',
  'repoPath',
  'raw',
  '_raw',
  '__proto__',
  'affiliate',
]);

export function buildPolicySnapshot(plan: ContentGenerationPlan): GenerationPolicySnapshot {
  const payload = plan.promptPayload!;

  const safetyConstraints = Object.freeze(
    payload.constraints
      .filter(
        (constraint) =>
          constraint.category === 'medical' ||
          constraint.category === 'evidence' ||
          constraint.category === 'disclosure',
      )
      .map((constraint) => constraint.id)
      .sort((a, b) => a.localeCompare(b)),
  );

  const affiliateConstraints = Object.freeze(
    payload.constraints
      .filter((constraint) => constraint.category === 'affiliate')
      .map((constraint) => constraint.id)
      .sort((a, b) => a.localeCompare(b)),
  );

  const citationRequirements = Object.freeze(
    payload.constraints
      .filter((constraint) => constraint.id === 'citation-placeholders')
      .map((constraint) => constraint.id),
  );

  const strictMode = plan.warnings.some((warning) => warning.code.includes('strict'));

  return Object.freeze({
    safetyConstraints,
    affiliateConstraints,
    citationRequirements,
    blockedFields: DEFAULT_BLOCKED_JOB_FIELDS,
    strictMode,
    contextComplete:
      plan.contextSummary.missingRequired.length === 0 && !plan.contextSummary.truncated,
    warningCount: plan.warnings.length + payload.warnings.length,
  });
}

export function countPolicyWarnings(plan: ContentGenerationPlan): number {
  return buildPolicySnapshot(plan).warningCount;
}
