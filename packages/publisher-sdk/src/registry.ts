/**
 * PublisherRegistry — provider discovery and instantiation — Sprint 34.
 *
 * The registry holds factory registrations keyed by `ProviderMetadata.id`.
 * The orchestrator (or any caller) can:
 *   - Register a provider at startup.
 *   - List all registered providers.
 *   - Create a provider instance by ID.
 *   - Check whether a provider is available.
 *
 * Design constraints:
 *   - No auto-discovery.  Providers are registered explicitly.
 *   - Thread-safe for single-process use (no async locking needed).
 *   - Adding a new provider never requires changing existing code.
 *
 * Usage:
 *
 *   import { PublisherRegistry } from '@pcme/publisher-sdk';
 *   import { wordPressRegistration } from '@pcme/plugin-wordpress';
 *
 *   const registry = new PublisherRegistry();
 *   registry.register(wordPressRegistration);
 *
 *   const provider = registry.create('wordpress', config);
 *   await provider.publish(request);
 */

import type { PublisherFactory } from './factory.js';
import type { ProviderMetadata } from './provider.js';
import type { PublisherProvider } from './provider.js';

// ---------------------------------------------------------------------------
// Registration descriptor
// ---------------------------------------------------------------------------

/**
 * Everything the registry needs to manage a provider:
 * - its static metadata (id, name, capabilities, …)
 * - a factory function to create instances on demand
 */
export type ProviderRegistration<TConfig = unknown> = {
  metadata: ProviderMetadata;
  factory: PublisherFactory<TConfig>;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class PublisherRegistry {
  private readonly registrations = new Map<string, ProviderRegistration>();

  /**
   * Register a provider.
   * Overwrites any existing registration with the same `metadata.id`.
   */
  register<TConfig>(registration: ProviderRegistration<TConfig>): void {
    this.registrations.set(registration.metadata.id, registration as ProviderRegistration);
  }

  /**
   * Return the registration for the given provider ID, or `undefined`.
   */
  get(id: string): ProviderRegistration | undefined {
    return this.registrations.get(id);
  }

  /**
   * Return true when a provider with the given ID is registered.
   */
  has(id: string): boolean {
    return this.registrations.has(id);
  }

  /**
   * List all registered provider registrations.
   */
  list(): ProviderRegistration[] {
    return [...this.registrations.values()];
  }

  /**
   * List the metadata of all registered providers.
   */
  listMetadata(): ProviderMetadata[] {
    return this.list().map((r) => r.metadata);
  }

  /**
   * Create a provider instance for `id` using `config`.
   *
   * @throws Error when the provider ID is not registered.
   */
  create<TConfig>(id: string, config: TConfig): PublisherProvider {
    const registration = this.registrations.get(id);
    if (!registration) {
      throw new Error(
        `PublisherRegistry: no provider registered for id="${id}". ` +
          `Registered: [${[...this.registrations.keys()].join(', ')}]`,
      );
    }
    return (registration.factory as PublisherFactory<TConfig>)(config);
  }

  /**
   * Remove a provider from the registry.
   * Returns true when the provider was found and removed.
   */
  unregister(id: string): boolean {
    return this.registrations.delete(id);
  }

  /**
   * Remove all registrations.
   */
  clear(): void {
    this.registrations.clear();
  }
}
