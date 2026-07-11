import type {
  EditorialIntelligenceFinding,
  EditorialIntelligenceReport,
  EditorialIntelligenceScores,
  EditorialModuleId,
  EditorialModuleSummary,
  PublicationReadinessAssessment,
} from '@pcme/shared';

const HUMAN_APPROVAL_NOTE = 'Human approval required before publication.';

function isBlockingFinding(finding: EditorialIntelligenceFinding): boolean {
  return finding.severity === 'high' && finding.confidence === 'high';
}

function buildModuleSummaries(
  findings: readonly EditorialIntelligenceFinding[],
  enabledModules: readonly EditorialModuleId[],
): readonly EditorialModuleSummary[] {
  return Object.freeze(
    enabledModules.map((module) => {
      const moduleFindings = findings.filter((finding) => finding.module === module);
      return Object.freeze({
        module,
        findingCount: moduleFindings.length,
        blockingFindingCount: moduleFindings.filter(isBlockingFinding).length,
      });
    }),
  );
}

function buildScores(
  findings: readonly EditorialIntelligenceFinding[],
): EditorialIntelligenceScores {
  const blockingFindings = findings.filter(isBlockingFinding).length;
  return Object.freeze({
    totalFindings: findings.length,
    blockingFindings,
    advisoryFindings: findings.length - blockingFindings,
  });
}

function buildPublicationReadiness(
  findings: readonly EditorialIntelligenceFinding[],
): PublicationReadinessAssessment {
  const blockingFindingCount = findings.filter(isBlockingFinding).length;
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

/** Aggregate module findings into a complete editorial intelligence report. */
export function aggregateEditorialIntelligenceReport(input: {
  readonly reportId: string;
  readonly artifactId: string;
  readonly profileId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly analyzedAt: string;
  readonly enabledModules: readonly EditorialModuleId[];
  readonly findings: readonly EditorialIntelligenceFinding[];
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
    findings: Object.freeze(input.findings.map((finding) => Object.freeze({ ...finding }))),
    scores,
    publicationReadiness,
  });
}
