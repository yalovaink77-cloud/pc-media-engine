import type { EditorialIntelligenceReport } from '@pcme/shared';

function cloneFinding(
  finding: EditorialIntelligenceReport['findings'][number],
): EditorialIntelligenceReport['findings'][number] {
  return Object.freeze({
    ...finding,
    recommendation: Object.freeze({ ...finding.recommendation }),
    acceptanceCriteria: Object.freeze({ ...finding.acceptanceCriteria }),
    location: finding.location ? Object.freeze({ ...finding.location }) : undefined,
    metadata: finding.metadata ? Object.freeze({ ...finding.metadata }) : undefined,
  });
}

function cloneReport(report: EditorialIntelligenceReport): EditorialIntelligenceReport {
  return Object.freeze({
    ...report,
    moduleSummaries: Object.freeze(
      report.moduleSummaries.map((summary) => Object.freeze({ ...summary })),
    ),
    findings: Object.freeze(report.findings.map((finding) => cloneFinding(finding))),
    scores: Object.freeze({ ...report.scores }),
    publicationReadiness: Object.freeze({ ...report.publicationReadiness }),
  });
}

/** Serialize an editorial intelligence report to canonical JSON. */
export function serializeEditorialIntelligenceReport(report: EditorialIntelligenceReport): string {
  return `${JSON.stringify(cloneReport(report), null, 2)}\n`;
}

/** Parse a serialized editorial intelligence report. */
export function parseEditorialIntelligenceReport(serialized: string): EditorialIntelligenceReport {
  const parsed = JSON.parse(serialized) as EditorialIntelligenceReport;
  return cloneReport(parsed);
}
