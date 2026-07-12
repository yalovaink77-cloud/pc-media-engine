import type {
  EditorialFinding,
  EditorialIntelligenceReport,
  PublicationReadinessAssessment,
  RevisionComparisonSummary,
} from '@pcme/shared';

export interface PilotSectionAssessment {
  readonly sectionId: string;
  readonly findingCount: number;
  readonly highSeverityCount: number;
}

export interface PilotUnresolvedFinding {
  readonly id: string;
  readonly code: string;
  readonly severity: EditorialFinding['severity'];
  readonly module: EditorialFinding['category'];
  readonly reason: string;
  readonly sectionId?: string;
}

export interface PilotAcceptanceReport {
  readonly productId: string;
  readonly overallPublicationReadiness: PublicationReadinessAssessment;
  readonly unresolvedFindings: readonly PilotUnresolvedFinding[];
  readonly strongestSections: readonly PilotSectionAssessment[];
  readonly weakestSections: readonly PilotSectionAssessment[];
  readonly remainingManualWork: readonly string[];
  readonly publishingRecommendation: string;
  readonly revisionComparison: RevisionComparisonSummary;
  readonly humanReviewStatus: string;
  readonly wordpressDraftStatus: 'ready' | 'blocked' | 'skipped';
  readonly published: false;
}

function resolveSectionId(finding: EditorialFinding): string {
  return finding.location?.sectionId ?? finding.location?.headingText ?? 'document';
}

function buildSectionAssessments(
  findings: readonly EditorialFinding[],
): readonly PilotSectionAssessment[] {
  const buckets = new Map<string, { findingCount: number; highSeverityCount: number }>();

  for (const finding of findings) {
    const sectionId = resolveSectionId(finding);
    const bucket = buckets.get(sectionId) ?? { findingCount: 0, highSeverityCount: 0 };
    bucket.findingCount += 1;
    if (finding.severity === 'high') {
      bucket.highSeverityCount += 1;
    }
    buckets.set(sectionId, bucket);
  }

  return Object.freeze(
    [...buckets.entries()]
      .map(([sectionId, counts]) =>
        Object.freeze({
          sectionId,
          findingCount: counts.findingCount,
          highSeverityCount: counts.highSeverityCount,
        }),
      )
      .sort((left, right) => left.sectionId.localeCompare(right.sectionId)),
  );
}

function buildRemainingManualWork(input: {
  readonly report: EditorialIntelligenceReport;
  readonly humanReviewStatus: string;
  readonly wordpressDraftStatus: PilotAcceptanceReport['wordpressDraftStatus'];
}): readonly string[] {
  const items: string[] = [];

  if (input.report.publicationReadiness.blockingFindingCount > 0) {
    items.push(
      `Resolve ${input.report.publicationReadiness.blockingFindingCount} blocking editorial intelligence findings.`,
    );
  }

  if (input.report.publicationReadiness.advisoryFindingCount > 0) {
    items.push(
      `Review ${input.report.publicationReadiness.advisoryFindingCount} advisory findings before publication.`,
    );
  }

  if (input.humanReviewStatus !== 'approved' && input.humanReviewStatus !== 'approved-with-notes') {
    items.push('Complete mandatory human review and record an explicit approval decision.');
  }

  if (input.wordpressDraftStatus === 'blocked') {
    items.push('Publishing handoff remains blocked until review approval and validation pass.');
  }

  if (input.wordpressDraftStatus === 'skipped') {
    items.push('WordPress draft upload was skipped because credentials were not configured.');
  }

  return Object.freeze(items);
}

function buildPublishingRecommendation(input: {
  readonly report: EditorialIntelligenceReport;
  readonly humanReviewStatus: string;
  readonly wordpressDraftStatus: PilotAcceptanceReport['wordpressDraftStatus'];
}): string {
  if (input.report.publicationReadiness.status === 'not-ready') {
    return 'Do not publish. Resolve blocking findings and complete human review before creating a live WordPress draft.';
  }

  if (input.humanReviewStatus !== 'approved' && input.humanReviewStatus !== 'approved-with-notes') {
    return 'Hold publication. The draft requires human approval even if advisory findings are acceptable.';
  }

  if (input.wordpressDraftStatus === 'ready') {
    return 'Safe to keep as a WordPress draft only. Do not publish live until editorial and compliance sign-off is complete.';
  }

  return 'Prepare a WordPress draft after human approval. Do not publish live while findings or review gates remain open.';
}

/** Build the PiercingConnect revenue acceptance report from post-revision intelligence output. */
export function buildPilotAcceptanceReport(input: {
  readonly productId: string;
  readonly report: EditorialIntelligenceReport;
  readonly comparison: RevisionComparisonSummary;
  readonly humanReviewStatus: string;
  readonly wordpressDraftStatus: PilotAcceptanceReport['wordpressDraftStatus'];
}): PilotAcceptanceReport {
  const sectionAssessments = buildSectionAssessments(input.report.findings);
  const strongestSections = Object.freeze(
    [...sectionAssessments]
      .sort((left, right) => {
        if (left.findingCount !== right.findingCount) {
          return left.findingCount - right.findingCount;
        }
        return left.highSeverityCount - right.highSeverityCount;
      })
      .slice(0, 5),
  );
  const weakestSections = Object.freeze(
    [...sectionAssessments]
      .sort((left, right) => {
        if (left.findingCount !== right.findingCount) {
          return right.findingCount - left.findingCount;
        }
        return right.highSeverityCount - left.highSeverityCount;
      })
      .slice(0, 5),
  );

  const unresolvedFindings = Object.freeze(
    input.report.findings.map((finding) =>
      Object.freeze({
        id: finding.id,
        code: finding.code,
        severity: finding.severity,
        module: finding.category,
        reason: finding.reason,
        sectionId: finding.location?.sectionId,
      }),
    ),
  );

  return Object.freeze({
    productId: input.productId,
    overallPublicationReadiness: Object.freeze({ ...input.report.publicationReadiness }),
    unresolvedFindings,
    strongestSections,
    weakestSections,
    remainingManualWork: buildRemainingManualWork(input),
    publishingRecommendation: buildPublishingRecommendation(input),
    revisionComparison: input.comparison,
    humanReviewStatus: input.humanReviewStatus,
    wordpressDraftStatus: input.wordpressDraftStatus,
    published: false,
  });
}
