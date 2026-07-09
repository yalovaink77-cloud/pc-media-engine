import type { CommerceBrand, CommerceProduct } from './types.js';

export interface ValidationResult {
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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
