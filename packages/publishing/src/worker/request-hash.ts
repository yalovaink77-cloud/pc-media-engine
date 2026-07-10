import { createHash } from 'node:crypto';

import type { PublishingHandoffPackagePayload } from '@pcme/shared';

/** Build a stable request hash for durable publish idempotency. */
export function buildPublishingWorkerRequestHash(payload: PublishingHandoffPackagePayload): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        handoffId: payload.handoffId,
        targetId: payload.target.targetId,
        contentLength: payload.content.length,
        slug: payload.publishingMetadata.slug,
      }),
    )
    .digest('hex')
    .slice(0, 32);
}
