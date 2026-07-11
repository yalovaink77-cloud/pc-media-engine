import type { KnowledgeEntity } from '../types.js';
import type {
  KnowledgeContextNode,
  KnowledgeProjectionLevel,
  KnowledgeProjectionPolicy,
} from './types.js';

const DEFAULT_BLOCKED_FIELDS = new Set([
  'template_path',
  'sourcePath',
  'source_path',
  'repoPath',
  'raw',
  '_raw',
  '__proto__',
]);

const DEFAULT_SUMMARY_FIELDS = new Set([
  'description',
  'summary',
  'category',
  'status',
  'ingredients',
  'healing_stages',
  'recommended_for',
  'not_recommended_for',
  'symptoms',
  'common_problems',
  'related_products',
  'related_ingredients',
  'related_brands',
  'related_problems',
  'related_piercing_types',
  'product_categories',
  'body_location',
  'search_intent',
  'trust',
  'review',
  'preservative_free',
  'sterile',
  'drug_free',
  'available_sizes',
  'entity_type',
  'website',
  'founded',
  'headquarters',
]);

function isAbsolutePath(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.includes('://'))
  );
}

function isBlockedValue(value: unknown): boolean {
  if (value instanceof Map) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => isBlockedValue(entry));
  }

  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) => isBlockedValue(entry));
  }

  return isAbsolutePath(value);
}

function normalizeFieldValue(value: unknown): unknown {
  if (value instanceof Map) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeFieldValue(entry)).filter((entry) => entry !== undefined);
  }

  if (value !== null && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (isBlockedValue(entry)) {
        continue;
      }
      const next = normalizeFieldValue(entry);
      if (next !== undefined) {
        normalized[key] = next;
      }
    }
    return Object.freeze(normalized);
  }

  if (isAbsolutePath(value)) {
    return undefined;
  }

  return value;
}

function buildBlockedFields(policy?: KnowledgeProjectionPolicy): Set<string> {
  const blocked = new Set(DEFAULT_BLOCKED_FIELDS);
  for (const field of policy?.blockedFields ?? []) {
    blocked.add(field);
  }
  return blocked;
}

function buildSummaryFields(policy?: KnowledgeProjectionPolicy): Set<string> {
  const summary = new Set(DEFAULT_SUMMARY_FIELDS);
  for (const field of policy?.summaryFields ?? []) {
    summary.add(field);
  }
  return summary;
}

function pickFields(
  entity: KnowledgeEntity,
  allowedFields: Set<string>,
  blockedFields: Set<string>,
): Readonly<Record<string, unknown>> {
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(entity.fields)) {
    if (blockedFields.has(key) || !allowedFields.has(key) || isBlockedValue(value)) {
      continue;
    }

    const normalized = normalizeFieldValue(value);
    if (normalized !== undefined) {
      fields[key] = normalized;
    }
  }

  return Object.freeze(fields);
}

/** Project a knowledge entity to an AI-safe context node. */
export function projectKnowledgeEntity(
  entity: KnowledgeEntity,
  projection: KnowledgeProjectionLevel,
  policy?: KnowledgeProjectionPolicy,
): KnowledgeContextNode {
  const blockedFields = buildBlockedFields(policy);

  if (projection === 'identity') {
    return Object.freeze({
      type: entity.type,
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      projection,
    });
  }

  const allowedFields =
    projection === 'summary' ? buildSummaryFields(policy) : new Set(Object.keys(entity.fields));

  const fields = pickFields(entity, allowedFields, blockedFields);

  return Object.freeze({
    type: entity.type,
    id: entity.id,
    slug: entity.slug,
    name: entity.name,
    projection,
    fields,
  });
}

/** Return true when a projected node contains blocked or internal-only values. */
export function containsBlockedProjectionData(node: KnowledgeContextNode): boolean {
  if (!node.fields) {
    return false;
  }

  for (const [key, value] of Object.entries(node.fields)) {
    if (DEFAULT_BLOCKED_FIELDS.has(key) || isBlockedValue(value)) {
      return true;
    }
  }

  return false;
}
