import type { EditorialFindingInput } from '@pcme/shared';

function compareFindingInputs(left: EditorialFindingInput, right: EditorialFindingInput): number {
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

/** Deduplicate editorial findings by stable identity key and sort deterministically. */
export function dedupeAndSortEditorialFindings(
  findings: readonly EditorialFindingInput[],
): readonly EditorialFindingInput[] {
  const unique = new Map<string, EditorialFindingInput>();

  for (const finding of findings) {
    const identityKey = finding.id ?? finding.code;
    const dedupeKey = `${finding.code}:${identityKey}`;
    if (!unique.has(dedupeKey)) {
      unique.set(dedupeKey, finding);
    }
  }

  return Object.freeze([...unique.values()].sort(compareFindingInputs));
}
