import type { PublishingMetadataPublishStatus, PublishingTargetAdapter } from '@pcme/publishing';
import { FakePublishingTargetAdapter } from '@pcme/publishing';

import { PiercingConnectPilotError } from './errors.js';

/**
 * Fail-closed gate: PiercingConnect pilot may only use a real WordPress adapter
 * when forceDraft is explicitly true. Does not change the generic adapter default.
 */
export function requirePilotWordPressForceDraft(options: { readonly forceDraft?: boolean }): {
  readonly forceDraft: true;
} {
  if (options.forceDraft !== true) {
    throw new PiercingConnectPilotError(
      'wordpress-force-draft-required',
      'PiercingConnect pilot refuses to use the real WordPress adapter unless forceDraft is true',
    );
  }

  return Object.freeze({ forceDraft: true as const });
}

/** Pilot handoff metadata may only request draft — never public publish. */
export function assertPilotDraftPublishStatus(
  publishStatus: PublishingMetadataPublishStatus | undefined,
): 'draft' {
  if (publishStatus !== 'draft') {
    throw new PiercingConnectPilotError(
      'wordpress-draft-only',
      'PiercingConnect pilot cannot emit a non-draft WordPress publish status',
    );
  }

  return 'draft';
}

/**
 * Resolve the publishing target for the pilot path.
 * Real WordPress adapters (targetId === 'wordpress') require forceDraft: true.
 */
export function resolvePilotPublishingTargetAdapter(input: {
  readonly publishingTargetAdapter?: PublishingTargetAdapter;
  readonly wordpressForceDraft?: boolean;
}): PublishingTargetAdapter {
  const adapter = input.publishingTargetAdapter ?? new FakePublishingTargetAdapter();

  if (adapter.targetId === 'wordpress') {
    requirePilotWordPressForceDraft({ forceDraft: input.wordpressForceDraft });
  }

  return adapter;
}
