/**
 * WordPress publisher logger — Sprint 34 refactor.
 *
 * Re-exports the canonical logger types from @pcme/publisher-sdk so that
 * existing imports of WordPressPublisherLogger / noopLogger / createConsoleLogger
 * continue to work without changes.
 */

export type {
  PublisherLogMeta as WordPressLogMeta,
  PublisherLogger as WordPressPublisherLogger,
} from '@pcme/publisher-sdk';
export { createConsoleLogger, noopLogger } from '@pcme/publisher-sdk';
