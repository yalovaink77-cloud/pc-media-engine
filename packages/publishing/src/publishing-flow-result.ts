/**
 * Result of a full publish flow: media upload followed by draft post creation.
 */

export type PublishingFlowStep = {
  externalId: string;
  url: string;
};

export type PublishingFlowResult = {
  /** True only when both media upload and draft creation succeed. */
  success: boolean;
  /** Present when media upload succeeded. */
  media?: PublishingFlowStep;
  /** Present when draft creation was attempted (may be empty on failure). */
  post?: PublishingFlowStep;
  /** Timestamp from the last successful step, or media step on partial failure. */
  publishedAt?: Date;
  /** Human-readable summary or error detail. */
  message?: string;
};
