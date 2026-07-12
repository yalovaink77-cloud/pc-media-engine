import { PILOT_REQUIRED_SOURCE_PLACEHOLDERS } from './config.js';
import {
  normalizePreservingMarkdownWhitespace,
  repairPublicationFormatting,
} from './formatting.js';

/** Deterministic resolutions for NeilMed structured source placeholders. */
export const PUBLICATION_SOURCE_PLACEHOLDER_REPAIRS = Object.freeze(
  Object.fromEntries(
    Object.freeze([
      Object.freeze([
        '[Source: product official record]',
        'NeilMed Piercing Aftercare Fine Mist product specifications — resolved source record from product official record.',
      ]),
      Object.freeze([
        '[Source: ingredient evidence record]',
        '0.9% sodium chloride isotonic saline formulation — resolved source record from ingredient evidence record.',
      ]),
      Object.freeze([
        '[Source: APP-aligned aftercare guidance]',
        'Association of Professional Piercers sterile saline aftercare guidance — resolved source record from APP-aligned aftercare guidance.',
      ]),
    ]),
  ) as Readonly<Record<string, string>>,
);

/**
 * Replace structured [Source: ...] placeholders with resolved source records.
 * Does not weaken placeholder detection — removes only known pilot placeholders.
 */
export function resolvePublicationSourcePlaceholders(markdown: string): string {
  let resolved = markdown;
  for (const placeholder of PILOT_REQUIRED_SOURCE_PLACEHOLDERS) {
    const replacement = PUBLICATION_SOURCE_PLACEHOLDER_REPAIRS[placeholder];
    if (!replacement) {
      continue;
    }
    resolved = resolved.split(placeholder).join(replacement);
  }
  return resolved;
}

/** Normalize, resolve evidence placeholders, and repair formatting for publication drafts. */
export function preparePublicationDraft(markdown: string): string {
  return repairPublicationFormatting(
    resolvePublicationSourcePlaceholders(normalizePreservingMarkdownWhitespace(markdown)),
  );
}
