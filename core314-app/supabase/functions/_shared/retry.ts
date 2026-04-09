// ============================================================================
// RETRY UTILITY — PRODUCTION HARDENING
// ============================================================================
// Provides exponential backoff retry logic for edge functions.
// Retries only on transient errors (network, 5xx, rate limits).
//
// Usage:
//   import { withRetry } from "../_shared/retry.ts";
//   const result = await withRetry(() => fetchData(), { maxRetries: 2, functionName: "signal-detector" });
// ============================================================================

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  functionName: string;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 1000,
  functionName: 'unknown',
};

/**
 * Determine if an error is transient and worth retrying.
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError && String(error.message).includes('fetch')) {
    return true; // Network error
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('socket hang up') ||
      msg.includes('aborted') ||
      msg.includes('503') ||
      msg.includes('502') ||
      msg.includes('429') ||
      msg.includes('rate limit')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Execute a function with exponential backoff retry on transient failures.
 * Logs each retry attempt for observability.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt < opts.maxRetries && isTransientError(error)) {
        const delayMs = opts.baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[${opts.functionName}] Transient error on attempt ${attempt + 1}/${opts.maxRetries + 1}: ${errorMessage}. Retrying in ${delayMs}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Non-transient error or max retries exhausted
        if (attempt > 0) {
          console.error(
            `[${opts.functionName}] Failed after ${attempt + 1} attempts: ${errorMessage}`
          );
        }
        throw error;
      }
    }
  }

  // Should not reach here, but TypeScript needs this
  throw lastError;
}
