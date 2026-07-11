import type {
  EditorialIntelligenceFinding,
  EditorialIntelligenceProfile,
  EditorialIntelligenceReport,
} from '@pcme/shared';

import type { GeneratedContentArtifact } from '../artifact/types.js';
import { aggregateEditorialIntelligenceReport } from './aggregate.js';
import {
  buildDeterministicEditorialFindingId,
  buildDeterministicEditorialReportId,
} from './ids.js';
import type { EditorialModuleAnalysisInput } from './module.js';
import { createDefaultEditorialModuleRegistry, type EditorialModuleRegistry } from './registry.js';

export interface EditorialIntelligenceAnalysisInput {
  readonly artifact: GeneratedContentArtifact;
  readonly profile: EditorialIntelligenceProfile;
  readonly analyzedAt?: string;
}

export interface EditorialIntelligenceOrchestratorOptions {
  readonly registry?: EditorialModuleRegistry;
  readonly reportIdGenerator?: (input: {
    artifactId: string;
    profileId: string;
    analyzedAt: string;
  }) => string;
  readonly findingIdGenerator?: (input: {
    reportId: string;
    module: EditorialIntelligenceFinding['module'];
    analyzerId: string;
    code: string;
    identityKey: string;
  }) => string;
}

function assignFindingIds(
  findings: readonly EditorialIntelligenceFinding[],
  reportId: string,
  findingIdGenerator: EditorialIntelligenceOrchestratorOptions['findingIdGenerator'],
): readonly EditorialIntelligenceFinding[] {
  const generateId = findingIdGenerator ?? buildDeterministicEditorialFindingId;

  return Object.freeze(
    findings.map((finding) =>
      Object.freeze({
        ...finding,
        findingId: generateId({
          reportId,
          module: finding.module,
          analyzerId: finding.analyzerId,
          code: finding.code,
          identityKey: finding.findingId || finding.code,
        }),
      }),
    ),
  );
}

/** Orchestrate editorial intelligence modules and aggregate a deterministic report. */
export class EditorialIntelligenceOrchestrator {
  private readonly registry: EditorialModuleRegistry;
  private readonly reportIdGenerator: NonNullable<
    EditorialIntelligenceOrchestratorOptions['reportIdGenerator']
  >;
  private readonly findingIdGenerator: NonNullable<
    EditorialIntelligenceOrchestratorOptions['findingIdGenerator']
  >;

  constructor(options: EditorialIntelligenceOrchestratorOptions = {}) {
    this.registry = options.registry ?? createDefaultEditorialModuleRegistry();
    this.reportIdGenerator = options.reportIdGenerator ?? buildDeterministicEditorialReportId;
    this.findingIdGenerator = options.findingIdGenerator ?? buildDeterministicEditorialFindingId;
  }

  analyze(input: EditorialIntelligenceAnalysisInput): EditorialIntelligenceReport {
    const analyzedAt = input.analyzedAt ?? new Date().toISOString();
    const reportId = this.reportIdGenerator({
      artifactId: input.artifact.artifactId,
      profileId: input.profile.profileId,
      analyzedAt,
    });

    const moduleInput: EditorialModuleAnalysisInput = Object.freeze({
      artifact: input.artifact,
      profile: input.profile,
      analyzedAt,
      reportId,
    });

    const enabledModules = this.registry.resolveEnabled(input.profile.enabledModules);
    const rawFindings = enabledModules.flatMap((module) => module.analyze(moduleInput));
    const findings = assignFindingIds(rawFindings, reportId, this.findingIdGenerator);

    return aggregateEditorialIntelligenceReport({
      reportId,
      artifactId: input.artifact.artifactId,
      profileId: input.profile.profileId,
      contentType: input.profile.contentType,
      locale: input.profile.locale,
      analyzedAt,
      enabledModules: input.profile.enabledModules,
      findings,
    });
  }
}

/** Create an editorial intelligence orchestrator with the default empty module registry. */
export function createEditorialIntelligenceOrchestrator(
  options?: EditorialIntelligenceOrchestratorOptions,
): EditorialIntelligenceOrchestrator {
  return new EditorialIntelligenceOrchestrator(options);
}
