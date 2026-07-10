import type { CommerceBrand, CommerceProduct } from './types.js';

export interface ValidationResult {
  errors: string[];
}

export interface NormalizedCommerceIdentity {
  id: string;
  slug: string;
  name: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readDisplayName(
  doc: Record<string, unknown>,
  displayNameFields: readonly string[] = [],
): string | undefined {
  if (isNonEmptyString(doc.name)) {
    return doc.name.trim();
  }

  for (const field of displayNameFields) {
    const value = doc[field];
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }

  return undefined;
}

/** Validate required identity fields on a parsed YAML document. */
export function validateCommerceRecord(record: unknown, entityLabel: string): ValidationResult {
  const errors: string[] = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { errors: [`${entityLabel} must be a YAML mapping`] };
  }

  const doc = record as Record<string, unknown>;

  if (!isNonEmptyString(doc.id)) errors.push('id is required');
  if (!isNonEmptyString(doc.slug)) errors.push('slug is required');
  if (!isNonEmptyString(doc.name)) errors.push('name is required');

  return { errors };
}

/** Normalize identity fields, applying adapter-specific display name fallbacks. */
export function normalizeCommerceIdentity(
  record: unknown,
  entityLabel: string,
  options?: { displayNameFields?: readonly string[] },
): { identity?: NormalizedCommerceIdentity; errors: string[] } {
  const errors: string[] = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { errors: [`${entityLabel} must be a YAML mapping`] };
  }

  const doc = record as Record<string, unknown>;

  if (!isNonEmptyString(doc.id)) {
    errors.push('id is required');
  }

  const slug = isNonEmptyString(doc.slug)
    ? doc.slug.trim()
    : isNonEmptyString(doc.id)
      ? doc.id.trim()
      : '';
  if (!slug) {
    errors.push('slug is required');
  }

  const name = readDisplayName(doc, options?.displayNameFields);
  if (!name) {
    errors.push('name is required');
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    identity: {
      id: (doc.id as string).trim(),
      slug,
      name: name as string,
    },
    errors,
  };
}

export function toCommerceBrand(record: Record<string, unknown>): CommerceBrand {
  return {
    id: record.id as string,
    slug: record.slug as string,
    name: record.name as string,
    raw: record,
  };
}

export function toCommerceProduct(record: Record<string, unknown>): CommerceProduct {
  return {
    id: record.id as string,
    slug: record.slug as string,
    name: record.name as string,
    raw: record,
  };
}

export function toCommerceCollectionRecord(
  record: Record<string, unknown>,
  identity: NormalizedCommerceIdentity,
): { id: string; slug: string; name: string; raw: Record<string, unknown> } {
  return {
    id: identity.id,
    slug: identity.slug,
    name: identity.name,
    raw: record,
  };
}
