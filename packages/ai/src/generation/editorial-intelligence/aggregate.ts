import type {
  EditorialFinding,
  EditorialIntelligenceReport,
  EditorialIntelligenceScores,
  EditorialModuleId,
  EditorialModuleSummary,
  PublicationReadinessAssessment,
} from '@pcme/shared';

import { isBlockingEditorialFinding } from './finding/validate.js';

const HUMAN_APPROVAL_NOTE = 'Human approval required before publication.';

function buildModuleSummaries(
  findings: readonly EditorialFinding[],
  enabledModules: readonly EditorialModuleId[],
): readonly EditorialModuleSummary[] {
  return Object.freeze(
    enabledModules.map((module) => {
      const moduleFindings = findings.filter((finding) => finding.category === module);
      return Object.freeze({
        module,
        findingCount: moduleFindings.length,
        blockingFindingCount: moduleFindings.filter(isBlockingEditorialFinding).length,
      });
    }),
  );
}

function buildScores(findings: readonly EditorialFinding[]): EditorialIntelligenceScores {
  const blockingFindings = findings.filter(isBlockingEditorialFinding).length;
  return Object.freeze({
    totalFindings: findings.length,
    blockingFindings,
    advisoryFindings: findings.length - blockingFindings,
  });
}

function buildPublicationReadiness(
  findings: readonly EditorialFinding[],
): PublicationReadinessAssessment {
  const blockingFindingCount = findings.filter(isBlockingEditorialFinding).length;
  const advisoryFindingCount = findings.length - blockingFindingCount;

  let status: PublicationReadinessAssessment['status'];
  if (blockingFindingCount > 0) {
    status = 'not-ready';
  } else if (advisoryFindingCount > 0) {
    status = 'needs-revision';
  } else {
    status = 'ready-for-human-review';
  }

  return Object.freeze({
    status,
    blockingFindingCount,
    advisoryFindingCount,
    note: HUMAN_APPROVAL_NOTE,
  });
}

function cloneFinding(finding: EditorialFinding): EditorialFinding {
  return Object.freeze({
    ...finding,
    recommendation: Object.freeze({ ...finding.recommendation }),
    acceptanceCriteria: Object.freeze({ ...finding.acceptanceCriteria }),
    location: finding.location ? Object.freeze({ ...finding.location }) : undefined,
    metadata: finding.metadata ? Object.freeze({ ...finding.metadata }) : undefined,
  });
}

/** Aggregate module findings into a complete editorial intelligence report. */
export function aggregateEditorialIntelligenceReport(input: {
  readonly reportId: string;
  readonly artifactId: string;
  readonly profileId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly analyzedAt: string;
  readonly enabledModules: readonly EditorialModuleId[];
  readonly findings: readonly EditorialFinding[];
}): EditorialIntelligenceReport {
  const scores = buildScores(input.findings);
  const publicationReadiness = buildPublicationReadiness(input.findings);

  return Object.freeze({
    reportId: input.reportId,
    artifactId: input.artifactId,
    profileId: input.profileId,
    contentType: input.contentType,
    locale: input.locale,
    analyzedAt: input.analyzedAt,
    moduleSummaries: buildModuleSummaries(input.findings, input.enabledModules),
    findings: Object.freeze(input.findings.map((finding) => cloneFinding(finding))),
    scores,
    publicationReadiness,
  });
}
