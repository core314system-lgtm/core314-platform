/**
 * Shared Sentry configuration constants
 */

export const SENTRY_CONFIG = {
  TRACES_SAMPLE_RATE: 0.3, // 30% of sessions for performance data
  REPLAYS_SESSION_SAMPLE_RATE: 0.08, // 8% of sessions
  REPLAYS_ON_ERROR_SAMPLE_RATE: 1.0, // 100% for sessions with errors
  
  MAX_BREADCRUMBS: 200,
  
  FLUSH_TIMEOUT_MS: 2000,
} as const;

/**
 * Patterns for errors to ignore (noise reduction)
 */
export const IGNORED_ERROR_PATTERNS = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  
  'AbortError',
  'The user aborted a request',
  
  'Network request failed',
  'Failed to fetch',
  'NetworkError',
  
  /ChunkLoadError/,
  /Loading chunk \d+ failed/,
  /Failed to fetch dynamically imported module/,
  
  /Hydration failed because/,
  /Minified React error/,
  
  'undefined',
  'null',
  '',
] as const;

/**
 * URL patterns to deny (browser extensions, etc.)
 */
export const DENIED_URL_PATTERNS = [
  /chrome-extension:\/\//,
  /moz-extension:\/\//,
  /safari-extension:\/\//,
  /about:blank/,
  /webkit-masked-url/,
] as const;

/**
 * Request paths to ignore in beforeSend
 */
export const IGNORED_REQUEST_PATHS = [
  '/sse',
  '/health',
  '/favicon.ico',
  '/_next/static',
  '/static/',
] as const;
