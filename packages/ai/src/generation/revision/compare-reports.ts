import type {
  EditorialFinding,
  EditorialIntelligenceReport,
  RevisionComparisonSummary,
} from '@pcme/shared';

function buildFindingMatchKey(finding: EditorialFinding): string {
  const sectionId = finding.location?.sectionId ?? '';
  const lineStart = finding.location?.lineRange?.start ?? 0;
  return `${finding.category}:${finding.code}:${sectionId}:${lineStart}`;
}

function indexFindingsById(findings: readonly EditorialFinding[]): Map<string, EditorialFinding> {
  return new Map(findings.map((finding) => [finding.id, finding]));
}

function indexFindingsByMatchKey(
  findings: readonly EditorialFinding[],
): Map<string, EditorialFinding[]> {
  const buckets = new Map<string, EditorialFinding[]>();
  for (const finding of findings) {
    const key = buildFindingMatchKey(finding);
    const bucket = buckets.get(key) ?? [];
    bucket.push(finding);
    buckets.set(key, bucket);
  }
  return buckets;
}

/** Compare editorial intelligence reports across revision passes. */
export function compareRevisionReports(input: {
  readonly priorReport: EditorialIntelligenceReport;
  readonly nextReport: EditorialIntelligenceReport;
}): RevisionComparisonSummary {
  const priorById = indexFindingsById(input.priorReport.findings);
  const nextById = indexFindingsById(input.nextReport.findings);
  const priorByKey = indexFindingsByMatchKey(input.priorReport.findings);
  const nextByKey = indexFindingsByMatchKey(input.nextReport.findings);

  const resolvedFindingIds: string[] = [];
  const persistingFindingIds: string[] = [];
  const newFindingIds: string[] = [];

  for (const [findingId, priorFinding] of priorById.entries()) {
    if (nextById.has(findingId)) {
      persistingFindingIds.push(findingId);
      continue;
    }

    const key = buildFindingMatchKey(priorFinding);
    const nextMatches = nextByKey.get(key) ?? [];
    if (nextMatches.length > 0) {
      persistingFindingIds.push(findingId);
      continue;
    }

    resolvedFindingIds.push(findingId);
  }

  for (const [findingId, nextFinding] of nextById.entries()) {
    if (priorById.has(findingId)) {
      continue;
    }

    const key = buildFindingMatchKey(nextFinding);
    const priorMatches = priorByKey.get(key) ?? [];
    if (priorMatches.length > 0) {
      continue;
    }

    newFindingIds.push(findingId);
  }

  const blockingRemainingCount = input.nextReport.findings.filter(
    (finding) => finding.severity === 'high',
  ).length;

  return Object.freeze({
    resolvedCount: resolvedFindingIds.length,
    persistingCount: persistingFindingIds.length,
    newCount: newFindingIds.length,
    blockingRemainingCount,
    resolvedFindingIds: Object.freeze([...resolvedFindingIds].sort()),
    persistingFindingIds: Object.freeze([...persistingFindingIds].sort()),
    newFindingIds: Object.freeze([...newFindingIds].sort()),
  });
}
