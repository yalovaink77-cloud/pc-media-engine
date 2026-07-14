import type { EditorialFindingInput, FindingCategory } from '@pcme/shared';

/**
 * Primary module ownership when the same finding code and location appear across modules.
 * Findings with different codes or recommendations are retained unless they share a semantic group.
 */
export const CROSS_MODULE_FINDING_OWNERSHIP = Object.freeze({
  'missing-faq-section': 'seo',
  'insufficient-faq-question-count': 'seo',
  'duplicate-faq-question': 'seo',
  'indirect-faq-answer': 'ai-seo',
  'unresolved-source-placeholder': 'evidence',
  'missing-required-source-placeholder': 'evidence',
  'missing-evidence-notes': 'evidence',
  'orphan-source-reference': 'evidence',
  'missing-required-section': 'editorial',
  'duplicate-h1': 'seo',
  'missing-h1': 'seo',
  'invalid-heading-hierarchy': 'seo',
  'thin-content-section': 'seo',
  'search-intent-gap': 'seo',
  'incomplete-audience-question-coverage': 'ai-seo',
} as const satisfies Partial<Record<string, FindingCategory>>);

const SEMANTIC_OWNERSHIP_GROUPS = Object.freeze([
  Object.freeze({
    key: 'section-thinness',
    owner: 'seo' as const,
    codes: Object.freeze(['thin-content-section', 'section-too-thin-to-stand-alone']),
  }),
  Object.freeze({
    key: 'source-transparency',
    owner: 'ai-seo' as const,
    codes: Object.freeze(['missing-verification-marker', 'low-source-transparency']),
  }),
  Object.freeze({
    key: 'promotional-tone',
    owner: 'commercial' as const,
    codes: Object.freeze(['promotional-tone', 'overly-promotional-language']),
    documentWide: true,
  }),
] as const);

function isDocumentWideSemanticGroup(
  group: (typeof SEMANTIC_OWNERSHIP_GROUPS)[number],
): group is (typeof SEMANTIC_OWNERSHIP_GROUPS)[number] & { readonly documentWide: true } {
  return 'documentWide' in group && group.documentWide === true;
}

function compareFindingInputs(left: EditorialFindingInput, right: EditorialFindingInput): number {
  if (left.category !== right.category) {
    return left.category.localeCompare(right.category);
  }
  if (left.code !== right.code) {
    return left.code.localeCompare(right.code);
  }
  const leftSection = left.location?.sectionId ?? '';
  const rightSection = right.location?.sectionId ?? '';
  if (leftSection !== rightSection) {
    return leftSection.localeCompare(rightSection);
  }
  const leftStart = left.location?.lineRange?.start ?? 0;
  const rightStart = right.location?.lineRange?.start ?? 0;
  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }
  return (left.id ?? left.code).localeCompare(right.id ?? right.code);
}

function buildLocationKey(finding: EditorialFindingInput): string {
  const sectionId = finding.location?.sectionId ?? '';
  const lineStart = finding.location?.lineRange?.start ?? 0;
  const identityKey = finding.id ?? finding.code;
  return `${finding.code}:${sectionId}:${lineStart}:${identityKey}`;
}

function buildSemanticGroupKey(finding: EditorialFindingInput, groupKey: string): string | null {
  const group = SEMANTIC_OWNERSHIP_GROUPS.find((entry) => entry.key === groupKey);
  if (!group || !(group.codes as readonly string[]).includes(finding.code)) {
    return null;
  }
  const sectionId = finding.location?.sectionId ?? '';
  const lineStart = finding.location?.lineRange?.start ?? 0;
  return `${groupKey}:${sectionId}:${lineStart}`;
}

function selectPrimaryIndex(
  findings: readonly EditorialFindingInput[],
  indices: readonly number[],
  owner?: FindingCategory,
): number {
  if (owner) {
    const owned = indices.find((index) => findings[index]?.category === owner);
    if (owned !== undefined) {
      return owned;
    }
  }
  return indices[0]!;
}

/** Deduplicate cross-module findings that share code/location or semantic ownership groups. */
export function dedupeCrossModuleFindings(
  findings: readonly EditorialFindingInput[],
): readonly EditorialFindingInput[] {
  const suppressed = new Set<number>();

  const locationGroups = new Map<string, number[]>();
  for (const [index, finding] of findings.entries()) {
    const key = buildLocationKey(finding);
    const group = locationGroups.get(key) ?? [];
    group.push(index);
    locationGroups.set(key, group);
  }

  for (const indices of locationGroups.values()) {
    if (indices.length <= 1) {
      continue;
    }

    const groupFindings = indices.map((index) => findings[index]!);
    const categories = new Set(groupFindings.map((finding) => finding.category));
    if (categories.size <= 1) {
      continue;
    }

    const owner =
      CROSS_MODULE_FINDING_OWNERSHIP[
        groupFindings[0]!.code as keyof typeof CROSS_MODULE_FINDING_OWNERSHIP
      ];
    const primaryIndex = selectPrimaryIndex(findings, indices, owner);
    for (const index of indices) {
      if (index !== primaryIndex) {
        suppressed.add(index);
      }
    }
  }

  for (const semanticGroup of SEMANTIC_OWNERSHIP_GROUPS) {
    const semanticBuckets = new Map<string, number[]>();
    for (const [index, finding] of findings.entries()) {
      if (suppressed.has(index)) {
        continue;
      }
      const semanticKey = buildSemanticGroupKey(finding, semanticGroup.key);
      if (!semanticKey) {
        continue;
      }
      const bucket = semanticBuckets.get(semanticKey) ?? [];
      bucket.push(index);
      semanticBuckets.set(semanticKey, bucket);
    }

    for (const indices of semanticBuckets.values()) {
      if (indices.length <= 1) {
        continue;
      }
      const groupFindings = indices.map((index) => findings[index]!);
      const categories = new Set(groupFindings.map((finding) => finding.category));
      if (categories.size <= 1) {
        continue;
      }
      const primaryIndex = selectPrimaryIndex(findings, indices, semanticGroup.owner);
      for (const index of indices) {
        if (index !== primaryIndex) {
          suppressed.add(index);
        }
      }
    }
  }

  for (const semanticGroup of SEMANTIC_OWNERSHIP_GROUPS) {
    if (!isDocumentWideSemanticGroup(semanticGroup)) {
      continue;
    }

    const indices: number[] = [];
    for (const [index, finding] of findings.entries()) {
      if (suppressed.has(index)) {
        continue;
      }
      if (!(semanticGroup.codes as readonly string[]).includes(finding.code)) {
        continue;
      }
      indices.push(index);
    }

    if (indices.length <= 1) {
      continue;
    }

    const categories = new Set(indices.map((index) => findings[index]!.category));
    if (categories.size <= 1) {
      continue;
    }

    const primaryIndex = selectPrimaryIndex(findings, indices, semanticGroup.owner);
    for (const index of indices) {
      if (index !== primaryIndex) {
        suppressed.add(index);
      }
    }
  }

  return Object.freeze(
    findings.filter((_, index) => !suppressed.has(index)).sort(compareFindingInputs),
  );
}
