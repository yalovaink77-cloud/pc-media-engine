import type {
  ContentReviewerIdentity,
  ContentRevisionItem,
  ContentRevisionRequest,
  EditorialFinding,
  EditorialIntelligenceReport,
  EditorialModuleId,
  GeneratedContentArtifact,
  RevisionModuleBundle,
  RevisionPriority,
} from '@pcme/shared';
import { DEFAULT_REVISION_GLOBAL_CONSTRAINTS, RevisionValidationError } from '@pcme/shared';

import { buildDeterministicRevisionItemId, buildDeterministicRevisionRequestId } from './ids.js';

const MODULE_ORDER = Object.freeze([
  'editorial',
  'evidence',
  'seo',
  'ai-seo',
  'commercial',
  'affiliate',
] as const satisfies readonly EditorialModuleId[]);

function compareModuleOrder(left: EditorialModuleId, right: EditorialModuleId): number {
  const leftIndex = MODULE_ORDER.indexOf(left);
  const rightIndex = MODULE_ORDER.indexOf(right);
  return (
    (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
    (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
  );
}

function compareFindings(left: EditorialFinding, right: EditorialFinding): number {
  const moduleOrder = compareModuleOrder(
    left.category as EditorialModuleId,
    right.category as EditorialModuleId,
  );
  if (moduleOrder !== 0) {
    return moduleOrder;
  }
  if (left.severity !== right.severity) {
    const severityRank = { high: 0, medium: 1, low: 2 } as const;
    return severityRank[left.severity] - severityRank[right.severity];
  }
  if (left.code !== right.code) {
    return left.code.localeCompare(right.code);
  }
  const leftSection = left.location?.sectionId ?? '';
  const rightSection = right.location?.sectionId ?? '';
  if (leftSection !== rightSection) {
    return leftSection.localeCompare(rightSection);
  }
  return left.id.localeCompare(right.id);
}

function buildFindingDedupeKey(finding: EditorialFinding): string {
  const sectionId = finding.location?.sectionId ?? '';
  const lineStart = finding.location?.lineRange?.start ?? 0;
  return `${finding.category}:${finding.code}:${sectionId}:${lineStart}`;
}

function dedupeFindings(findings: readonly EditorialFinding[]): readonly EditorialFinding[] {
  const seen = new Set<string>();
  const deduped: EditorialFinding[] = [];

  for (const finding of [...findings].sort(compareFindings)) {
    const key = buildFindingDedupeKey(finding);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(finding);
  }

  return Object.freeze(deduped);
}

function calculateRevisionPriority(findings: readonly EditorialFinding[]): RevisionPriority {
  if (findings.some((finding) => finding.severity === 'high')) {
    return 'must-fix';
  }
  if (findings.some((finding) => finding.severity === 'medium')) {
    return 'should-fix';
  }
  return 'nice-to-have';
}

function mapFindingToRevisionItem(
  finding: EditorialFinding,
  revisionRequestId: string,
): ContentRevisionItem {
  return Object.freeze({
    itemId: buildDeterministicRevisionItemId({
      revisionRequestId,
      findingId: finding.id,
    }),
    findingId: finding.id,
    module: finding.category,
    code: finding.code,
    severity: finding.severity,
    confidence: finding.confidence,
    reason: finding.reason,
    recommendation: Object.freeze({ ...finding.recommendation }),
    acceptanceCriteria: Object.freeze({ ...finding.acceptanceCriteria }),
    checkId: finding.checkId,
    location: finding.location ? Object.freeze({ ...finding.location }) : undefined,
  });
}

function groupRevisionItems(
  items: readonly ContentRevisionItem[],
): readonly RevisionModuleBundle[] {
  const bundles = new Map<EditorialModuleId, ContentRevisionItem[]>();

  for (const item of items) {
    const module = item.module as EditorialModuleId;
    const group = bundles.get(module) ?? [];
    group.push(item);
    bundles.set(module, group);
  }

  return Object.freeze(
    [...bundles.entries()]
      .sort(([left], [right]) => compareModuleOrder(left, right))
      .map(([module, moduleItems]) =>
        Object.freeze({
          module,
          items: Object.freeze(
            [...moduleItems].sort((left, right) => left.itemId.localeCompare(right.itemId)),
          ),
        }),
      ),
  );
}

export interface BuildRevisionRequestFromReportInput {
  readonly reviewId: string;
  readonly priorArtifact: GeneratedContentArtifact;
  readonly report: EditorialIntelligenceReport;
  readonly reviewer: ContentReviewerIdentity;
  readonly sourceSnapshotId: string;
  readonly selectedFindingIds?: readonly string[];
  readonly humanNotes?: string;
  readonly createdAt?: string;
  readonly revisionRequestIdGenerator?: typeof buildDeterministicRevisionRequestId;
}

/** Build a structured revision request from an editorial intelligence report. */
export function buildRevisionRequestFromReport(
  input: BuildRevisionRequestFromReportInput,
): ContentRevisionRequest {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const selectedIds = input.selectedFindingIds ? new Set(input.selectedFindingIds) : undefined;

  let findings = dedupeFindings(input.report.findings);
  if (selectedIds) {
    findings = Object.freeze(findings.filter((finding) => selectedIds.has(finding.id)));
  }

  if (findings.length === 0) {
    throw new RevisionValidationError(
      'empty-revision-request',
      'Revision request must include at least one finding',
      input.reviewId,
    );
  }

  const revisionRequestId = (
    input.revisionRequestIdGenerator ?? buildDeterministicRevisionRequestId
  )({
    reviewId: input.reviewId,
    reportId: input.report.reportId,
    createdAt,
    selectedFindingIds: input.selectedFindingIds,
  });

  const items = Object.freeze(
    findings.map((finding) => mapFindingToRevisionItem(finding, revisionRequestId)),
  );

  return Object.freeze({
    revisionRequestId,
    reviewId: input.reviewId,
    priorArtifactId: input.priorArtifact.artifactId,
    rootArtifactId: input.priorArtifact.rootArtifactId ?? input.priorArtifact.artifactId,
    sourceSnapshotId: input.sourceSnapshotId,
    reviewer: Object.freeze({ ...input.reviewer }),
    priority: calculateRevisionPriority(findings),
    status: 'pending',
    globalConstraints: DEFAULT_REVISION_GLOBAL_CONSTRAINTS,
    moduleBundles: groupRevisionItems(items),
    humanNotes: input.humanNotes,
    createdAt,
  });
}
