import { createHash } from 'node:crypto';

import type { KnowledgeContextWarning } from '../knowledge/context/types.js';
import type { PromptPayloadWarning } from '../prompt/types.js';
import type { ContentGenerationRequest, ContentGenerationWarning } from './types.js';

export function buildDeterministicRequestId(
  request: ContentGenerationRequest,
  sourceKey: string,
): string {
  const payload = JSON.stringify({
    root: request.root,
    contextRecipe: request.contextRecipe,
    contentType: request.contentType,
    locale: request.locale ?? 'en',
    tone: request.tone ?? 'educational',
    outputFormat: request.outputFormat ?? 'markdown',
    strict: request.strict ?? false,
    sourceKey,
  });

  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function normalizeSnapshotWarnings(warnings: readonly string[]): ContentGenerationWarning[] {
  return warnings.map((message) =>
    Object.freeze({
      code: 'snapshot-warning',
      message,
      source: 'snapshot' as const,
      severity: 'warning' as const,
    }),
  );
}

export function normalizeContextWarnings(
  warnings: readonly KnowledgeContextWarning[],
): ContentGenerationWarning[] {
  return warnings.map((warning) =>
    Object.freeze({
      code: warning.code,
      message: warning.message,
      source: 'context' as const,
      severity: warning.code === 'missing-required-type' ? ('warning' as const) : ('info' as const),
    }),
  );
}

export function normalizePromptWarnings(
  warnings: readonly PromptPayloadWarning[],
): ContentGenerationWarning[] {
  return warnings.map((warning) =>
    Object.freeze({
      code: warning.code,
      message: warning.message,
      source: 'prompt' as const,
      severity: 'warning' as const,
    }),
  );
}

export function sortGenerationWarnings(
  warnings: readonly ContentGenerationWarning[],
): readonly ContentGenerationWarning[] {
  return Object.freeze(
    [...warnings].sort((a, b) => {
      const sourceOrder = a.source.localeCompare(b.source);
      if (sourceOrder !== 0) {
        return sourceOrder;
      }
      const codeOrder = a.code.localeCompare(b.code);
      if (codeOrder !== 0) {
        return codeOrder;
      }
      return a.message.localeCompare(b.message);
    }),
  );
}

export function dedupeGenerationWarnings(
  warnings: readonly ContentGenerationWarning[],
): readonly ContentGenerationWarning[] {
  const seen = new Set<string>();
  const deduped: ContentGenerationWarning[] = [];

  for (const warning of warnings) {
    const key = `${warning.source}:${warning.code}:${warning.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(warning);
  }

  return sortGenerationWarnings(deduped);
}
