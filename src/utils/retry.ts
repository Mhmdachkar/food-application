import { logger } from './logger';

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Initial delay in ms before the first retry. Default: 500 */
  delayMs?: number;
  /** Multiplier applied to delay after each retry. Default: 2 */
  backoff?: number;
  /** Optional label for log messages. */
  label?: string;
  /** Return true to retry on this error. Default: retry on all errors. */
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'label' | 'shouldRetry'>> = {
  maxAttempts: 3,
  delayMs: 500,
  backoff: 2,
};

/**
 * Execute `fn` with automatic retries and exponential backoff.
 *
 * Only retries on errors that pass the optional `shouldRetry` predicate.
 * By default every error triggers a retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts;
  const initialDelay = options?.delayMs ?? DEFAULT_OPTIONS.delayMs;
  const backoff = options?.backoff ?? DEFAULT_OPTIONS.backoff;
  const label = options?.label ?? 'withRetry';
  const shouldRetry = options?.shouldRetry;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Don't retry if shouldRetry says no
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      if (attempt < maxAttempts) {
        logger.warn(
          `[${label}] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`,
          error instanceof Error ? error.message : error,
        );
        await sleep(delay);
        delay *= backoff;
      }
    }
  }

  // All attempts exhausted
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns true for errors that are likely transient (network, timeout, 5xx).
 * Returns false for client errors (4xx) which should not be retried.
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // Network / timeout patterns
  if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('fetch failed') ||
    lower.includes('socket hang up')
  ) {
    return true;
  }

  // Supabase / PostgREST error codes — 5xx are transient
  const anyObj = error as Record<string, unknown>;
  if (typeof anyObj?.code === 'string') {
    const code = anyObj.code;
    if (code.startsWith('5') || code === 'PGRST301') return true;
  }
  if (typeof anyObj?.status === 'number') {
    if (anyObj.status >= 500) return true;
  }

  return false;
}
