import type { PublishingTargetAdapter } from '../handoff/types.js';
import type { PublishingTargetAdapterRegistry } from './types.js';

/** Create a generic adapter registry keyed by targetId. */
export function createPublishingTargetAdapterRegistry(
  adapters: readonly PublishingTargetAdapter[],
): PublishingTargetAdapterRegistry {
  const byTargetId = new Map<string, PublishingTargetAdapter>(
    adapters.map((adapter) => [adapter.targetId, adapter]),
  );

  return Object.freeze({
    get: (targetId: string) => byTargetId.get(targetId),
    has: (targetId: string) => byTargetId.has(targetId),
  });
}
