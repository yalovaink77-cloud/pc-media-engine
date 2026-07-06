/**
 * @pcme/publisher-sdk — Sprint 34
 *
 * Common provider framework for all publishing destinations.
 *
 * Usage:
 *   import type { PublisherProvider, PublisherCapabilities } from '@pcme/publisher-sdk';
 *   import { PublisherRegistry, noopLogger } from '@pcme/publisher-sdk';
 */

// Re-export core @pcme/publishing types so consumers can import everything
// they need from a single package.
export type {
  HealthResult,
  HealthStatus,
  Publisher,
  PublishingRequest,
  PublishingResult,
} from '@pcme/publishing';
export { PublishingValidationError } from '@pcme/publishing';

// Configuration
export type { ConfigValidationResult, PublisherConfiguration } from './config.js';

// Context
export type { PublisherContext } from './context.js';

// Errors
export type { ErrorCategory } from './errors.js';
export { isRetryableCategory, isRetryableError, PublisherError } from './errors.js';

// Factory
export type { PublisherFactory } from './factory.js';

// Health
export type { ProviderHealth, ProviderHealthStatus } from './health.js';

// Logger
export type { PublisherLogger, PublisherLogMeta } from './logger.js';
export { createConsoleLogger, noopLogger } from './logger.js';

// Provider contract
export type { ProviderMetadata, PublisherCapabilities, PublisherProvider } from './provider.js';
export { isPublisherProvider } from './provider.js';

// Registry
export type { ProviderRegistration } from './registry.js';
export { PublisherRegistry } from './registry.js';

// Timeout
export { createTimeoutSignal, DEFAULT_PROVIDER_TIMEOUT_MS } from './timeout.js';

// Validation
export { validateProviderMetadata, validatePublisherCapabilities } from './validation.js';
