/**
 * Centralized logger that only outputs in development mode.
 * Drop-in replacement for console.log / console.warn / console.error.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.log('[Service]', 'message', data);
 *   logger.warn('[Service]', 'something unexpected');
 *   logger.error('[Service]', 'critical failure', err);
 */

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

function noop(..._args: unknown[]): void {}

export const logger = {
  log: isDev ? console.log.bind(console) : noop,
  warn: isDev ? console.warn.bind(console) : noop,
  error: isDev ? console.error.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  debug: isDev ? console.debug.bind(console) : noop,
};
