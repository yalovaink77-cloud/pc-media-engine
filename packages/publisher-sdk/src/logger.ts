/**
 * PublisherLogger — canonical logger interface for all providers — Sprint 34.
 *
 * Providers accept a `PublisherLogger` at construction time so the calling
 * application can inject its own logging infrastructure (pino, winston, etc.)
 * without the SDK taking a hard dependency on any framework.
 *
 * Usage in a provider:
 *
 *   import type { PublisherLogger } from '@pcme/publisher-sdk';
 *   import { noopLogger } from '@pcme/publisher-sdk';
 *
 *   class MyProvider {
 *     private readonly log: PublisherLogger;
 *     constructor(options: { logger?: PublisherLogger } = {}) {
 *       this.log = options.logger ?? noopLogger;
 *     }
 *   }
 */

export type PublisherLogMeta = Record<string, unknown>;

export interface PublisherLogger {
  info(event: string, meta?: PublisherLogMeta): void;
  warn(event: string, meta?: PublisherLogMeta): void;
  error(event: string, meta?: PublisherLogMeta): void;
}

// ---------------------------------------------------------------------------
// Built-in implementations
// ---------------------------------------------------------------------------

/** Silent logger — safe default when no logger is injected. */
export const noopLogger: PublisherLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * Console logger — suitable for development scripts and smoke tests.
 *
 * @param prefix  Optional prefix prepended to every log line, e.g. "[wordpress]".
 */
export function createConsoleLogger(prefix = '[provider]'): PublisherLogger {
  return {
    info(event, meta) {
      const extra = meta ? ` ${JSON.stringify(meta)}` : '';
      console.log(`${prefix} ℹ ${event}${extra}`);
    },
    warn(event, meta) {
      const extra = meta ? ` ${JSON.stringify(meta)}` : '';
      console.warn(`${prefix} ⚠  ${event}${extra}`);
    },
    error(event, meta) {
      const extra = meta ? ` ${JSON.stringify(meta)}` : '';
      console.error(`${prefix} ✗ ${event}${extra}`);
    },
  };
}
