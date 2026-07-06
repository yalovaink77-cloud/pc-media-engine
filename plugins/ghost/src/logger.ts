/**
 * Ghost publisher logger — re-exports from @pcme/publisher-sdk.
 */

export type {
  PublisherLogMeta as GhostLogMeta,
  PublisherLogger as GhostPublisherLogger,
} from '@pcme/publisher-sdk';
export { createConsoleLogger, noopLogger } from '@pcme/publisher-sdk';
