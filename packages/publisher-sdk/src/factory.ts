/**
 * PublisherFactory — typed provider construction abstraction — Sprint 34.
 *
 * A factory is a pure function that accepts a provider-specific config
 * object and returns a `PublisherProvider`.  Factories are registered in
 * the `PublisherRegistry` so the orchestrator can create providers by name
 * without hard-coding imports.
 *
 * Example:
 *
 *   const wordPressFactory: PublisherFactory<WordPressConfig> = (cfg) =>
 *     new WordPressMediaPublisher(cfg);
 *
 *   registry.register({ metadata: WP_METADATA, factory: wordPressFactory });
 *   const provider = registry.create('wordpress', myConfig);
 */

import type { PublisherProvider } from './provider.js';

/**
 * A callable that constructs a `PublisherProvider` from a typed config.
 *
 * @template TConfig  Provider-specific configuration type.
 */
export type PublisherFactory<TConfig = unknown> = (config: TConfig) => PublisherProvider;
