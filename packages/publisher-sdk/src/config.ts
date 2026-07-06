/**
 * PublisherConfiguration — typed config loading abstraction — Sprint 34.
 *
 * Every provider should expose a `PublisherConfiguration<TConfig>` that
 * implements these two methods.  This lets the registry and factory handle
 * config loading and validation in a uniform way.
 *
 * Example implementation for WordPress:
 *
 *   const wordPressConfiguration: PublisherConfiguration<WordPressConfig> = {
 *     load: (env) => loadWordPressConfig(env),
 *     validate: (cfg) => validateWordPressConfigStrict(cfg),
 *   };
 */

export type ConfigValidationResult = {
  /** Fatal problems that will prevent publishing. */
  errors: string[];
  /** Non-fatal problems that may degrade publishing quality. */
  warnings: string[];
};

export interface PublisherConfiguration<TConfig> {
  /**
   * Load provider configuration from environment variables.
   * Should throw a descriptive error on missing required fields.
   *
   * @param env  Environment map.  Defaults to `process.env`.
   */
  load(env?: Record<string, string | undefined>): TConfig;

  /**
   * Validate a loaded config for production readiness.
   * Must not throw — return errors/warnings in the result object instead.
   */
  validate(config: TConfig): ConfigValidationResult;
}
