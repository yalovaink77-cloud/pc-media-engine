import type { KnowledgeContextNode } from '../knowledge/context/types.js';

const BLOCKED_SERIALIZATION_KEYS = new Set([
  'template_path',
  'sourcePath',
  'source_path',
  'repoPath',
  'raw',
  '_raw',
  '__proto__',
  'affiliate',
]);

function isAbsolutePath(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.includes('://'))
  );
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Map) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry)).filter((entry) => entry !== undefined);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_SERIALIZATION_KEYS.has(key) || isAbsolutePath(entry)) {
        continue;
      }
      const next = sanitizeValue(entry);
      if (next !== undefined) {
        sanitized[key] = next;
      }
    }
    return Object.freeze(sanitized);
  }

  if (isAbsolutePath(value)) {
    return undefined;
  }

  return value;
}

/** Serialize a context node for prompt sections without leaking blocked metadata. */
export function serializeContextNode(node: KnowledgeContextNode): string {
  const payload = Object.freeze({
    type: node.type,
    id: node.id,
    slug: node.slug,
    name: node.name,
    projection: node.projection,
    fields: node.fields ? sanitizeValue(node.fields) : undefined,
  });

  return JSON.stringify(payload);
}

/** Serialize multiple context nodes in deterministic order. */
export function serializeContextNodes(nodes: readonly KnowledgeContextNode[] | undefined): string {
  if (!nodes || nodes.length === 0) {
    return '[]';
  }

  const serialized = [...nodes]
    .sort((a, b) => {
      const typeOrder = a.type.localeCompare(b.type);
      if (typeOrder !== 0) {
        return typeOrder;
      }
      return a.id.localeCompare(b.id);
    })
    .map((node) => JSON.parse(serializeContextNode(node)) as unknown);

  return JSON.stringify(serialized);
}

/** Return true when serialized prompt content contains blocked metadata patterns. */
export function containsBlockedPromptMetadata(content: string): boolean {
  if (content.includes('template_path') || content.includes('sourcePath')) {
    return true;
  }

  if (/\/(?:home|tmp|var|Users)\//.test(content)) {
    return true;
  }

  return false;
}
