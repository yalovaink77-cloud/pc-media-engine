/**
 * PublisherLogger tests — Sprint 34.
 */

import { describe, expect, it, vi } from 'vitest';

import { createConsoleLogger, noopLogger } from '../logger.js';

describe('noopLogger', () => {
  it('info does not throw', () => {
    expect(() => noopLogger.info('event')).not.toThrow();
  });

  it('warn does not throw', () => {
    expect(() => noopLogger.warn('event', { key: 'val' })).not.toThrow();
  });

  it('error does not throw', () => {
    expect(() => noopLogger.error('event')).not.toThrow();
  });
});

describe('createConsoleLogger', () => {
  it('info calls console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const log = createConsoleLogger('[test]');
    log.info('test.event', { k: 1 });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('[test]');
    expect(spy.mock.calls[0]?.[0]).toContain('test.event');
    spy.mockRestore();
  });

  it('warn calls console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = createConsoleLogger();
    log.warn('warn.event');
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('error calls console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = createConsoleLogger();
    log.error('error.event', { reason: 'boom' });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('includes meta in the log line', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const log = createConsoleLogger('[sdk]');
    log.info('with.meta', { userId: 42 });
    expect(spy.mock.calls[0]?.[0]).toContain('"userId":42');
    spy.mockRestore();
  });

  it('omits meta when not provided', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const log = createConsoleLogger('[sdk]');
    log.info('no.meta');
    expect(spy.mock.calls[0]?.[0]).not.toContain('{');
    spy.mockRestore();
  });

  it('uses default prefix [provider] when none given', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const log = createConsoleLogger();
    log.info('event');
    expect(spy.mock.calls[0]?.[0]).toContain('[provider]');
    spy.mockRestore();
  });
});
