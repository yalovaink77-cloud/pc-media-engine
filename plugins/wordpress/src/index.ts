export { buildBasicAuth } from './auth.js';
export type { WordPressConfig, WordPressConfigValidation } from './config.js';
export {
  isConfigComplete,
  isHttpsUrl,
  isValidWordPressUrl,
  loadWordPressConfig,
  validateWordPressConfigStrict,
  WordPressConfigError,
} from './config.js';
export type { WordPressErrorCategory } from './errors.js';
export {
  categorizeHttpStatus,
  categorizeWpErrorCode,
  isRetryableError,
  parseWordPressErrorResponse,
  WordPressApiError,
} from './errors.js';
export type { WordPressLogMeta, WordPressPublisherLogger } from './logger.js';
export { createConsoleLogger, noopLogger } from './logger.js';
// Sprint 34: provider registration
export type {
  WordPressHandoffAdapterConfig,
  WordPressHandoffPostStatus,
} from './handoff-config.js';
export {
  hasWordPressHandoffCredentials,
  loadWordPressHandoffAdapterConfig,
} from './handoff-config.js';
export type { WordPressHandoffErrorCode } from './handoff-errors.js';
export { redactWordPressSecrets } from './handoff-errors.js';
export { InMemoryWordPressHandoffIdempotencyStore } from './handoff-idempotency.js';
export {
  convertHandoffContent,
  convertMarkdownToHtml,
  mapHandoffToWordPressPost,
  mapPublishStatus,
} from './handoff-mapper.js';
export {
  WORDPRESS_CAPABILITIES,
  WORDPRESS_METADATA,
  wordPressRegistration,
} from './registration.js';
export type { MediaValidationOptions } from './validator.js';
export {
  ALLOWED_MEDIA_MIME_TYPES,
  DEFAULT_MAX_MEDIA_SIZE_BYTES,
  validateMediaRequest,
  validatePostRequest,
} from './validator.js';
export type { FetchFunction, WordPressMediaPublisherOptions } from './wordpress-media.publisher.js';
export { WordPressMediaPublisher } from './wordpress-media.publisher.js';
export type { WordPressPublishingTargetAdapterOptions } from './wordpress-publishing-target.adapter.js';
export {
  createWordPressPublishingTargetAdapter,
  WordPressPublishingTargetAdapter,
} from './wordpress-publishing-target.adapter.js';
