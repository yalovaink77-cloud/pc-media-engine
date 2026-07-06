/**
 * BullMQ publishing job payload — API mirror of worker publishing-payload.ts (Sprint 41).
 */

export type PublishingJobPayload = {
  title: string;
  slug: string;
  body: string;
  organizationId?: string;
  projectId?: string;
  assetId?: string;
  processingJobId?: string;
  /** Registry publisher id (wordpress, ghost, …). */
  publisherId?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaBuffer?: string;
  mediaData?: string;
  scheduledFor?: string;
};

export function encodeMediaBuffer(buffer: Buffer): string {
  return buffer.toString('base64');
}
