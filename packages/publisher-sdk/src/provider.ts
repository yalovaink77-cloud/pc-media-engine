/**
 * PublisherProvider — the core provider interface — Sprint 34.
 *
 * Extends `Publisher` from `@pcme/publishing` with structured metadata
 * and capability flags.  Existing code that depends only on `Publisher`
 * continues to work unchanged.
 *
 * New providers should implement `PublisherProvider`.
 * Existing providers (WordPress) gain these two new methods without any
 * behavioural changes.
 */

import type { Publisher } from '@pcme/publishing';

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Feature flags describing what a provider is capable of.
 * Used by the orchestrator to choose the right publish strategy.
 */
export type PublisherCapabilities = {
  /** Provider accepts raw media buffers (images, video, PDF). */
  mediaUpload: boolean;
  /** Provider can create text posts / articles. */
  postCreation: boolean;
  /** Provider supports native draft status. */
  drafts: boolean;
  /** Provider supports tag taxonomy. */
  tags: boolean;
  /** Provider supports hierarchical categories. */
  categories: boolean;
  /** Provider supports a featured / hero image. */
  featuredImages: boolean;
  /**
   * Provider supports delayed / scheduled publishing.
   * When false, scheduled jobs are published immediately by the worker.
   */
  scheduling: boolean;
  /** Provider can update previously published content. */
  update: boolean;
  /** Provider can delete previously published content. */
  delete: boolean;
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Static metadata describing a provider.
 * Returned by `PublisherProvider.getMetadata()`.
 */
export type ProviderMetadata = {
  /**
   * Unique, lowercase, hyphen-separated provider identifier.
   * Used as the registry key.  Must be stable across versions.
   *
   * Examples: "wordpress", "ghost", "medium", "dev-to", "linkedin"
   */
  id: string;

  /** Human-readable display name. */
  name: string;

  /** SemVer string of the provider implementation. */
  version: string;

  /** One-sentence description of the publishing destination. */
  description: string;

  /** What this provider can do. */
  capabilities: PublisherCapabilities;

  /** Homepage or documentation URL for this provider (optional). */
  homepageUrl?: string;
};

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * PublisherProvider — full provider contract extending Publisher.
 *
 * Any class that implements Publisher can be upgraded to PublisherProvider
 * by adding `getMetadata()` and `getCapabilities()`.  These are read-only
 * introspection methods and must not trigger network requests.
 */
export interface PublisherProvider extends Publisher {
  /**
   * Return static metadata about this provider.
   * Must not throw.  Must not make network requests.
   */
  getMetadata(): ProviderMetadata;

  /**
   * Return the current capability flags.
   * For most providers this is static and equals `getMetadata().capabilities`.
   * Dynamic providers may adjust flags based on loaded configuration.
   */
  getCapabilities(): PublisherCapabilities;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Return true when `obj` implements the `PublisherProvider` interface.
 */
export function isPublisherProvider(obj: unknown): obj is PublisherProvider {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as Record<string, unknown>)['getMetadata'] === 'function' &&
    typeof (obj as Record<string, unknown>)['getCapabilities'] === 'function' &&
    typeof (obj as Record<string, unknown>)['publish'] === 'function' &&
    typeof (obj as Record<string, unknown>)['health'] === 'function'
  );
}
