/**
 * Structured logger interface for the WordPress publisher — Sprint 33.
 *
 * Decouples the publisher from any specific logging library.
 * Pass a pino/winston/console implementation at construction time.
 *
 * All events include at minimum a `publisher` tag so log aggregators can
 * filter by publisher name.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type WordPressLogMeta = Record<string, unknown>;

export interface WordPressPublisherLogger {
  info(event: string, meta?: WordPressLogMeta): void;
  warn(event: string, meta?: WordPressLogMeta): void;
  error(event: string, meta?: WordPressLogMeta): void;
}

// ---------------------------------------------------------------------------
// No-op implementation — used when no logger is injected
// ---------------------------------------------------------------------------

export const noopLogger: WordPressPublisherLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// ---------------------------------------------------------------------------
// Console implementation — suitable for development and scripts
// ---------------------------------------------------------------------------

export function createConsoleLogger(prefix = '[wordpress]'): WordPressPublisherLogger {
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
