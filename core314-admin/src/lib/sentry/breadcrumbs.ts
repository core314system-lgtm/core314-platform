/**
 * Sentry breadcrumb utilities
 * Enhanced breadcrumb logging for API requests and UI interactions
 */

import * as Sentry from '@sentry/react';

const FETCH_WRAPPED_SYMBOL = Symbol.for('sentry.fetch.wrapped');

/**
 * Wrap window.fetch to add breadcrumbs for all API requests
 * Idempotent - only wraps once
 */
export function wrapFetchWithBreadcrumbs(): void {
  if ((window as any)[FETCH_WRAPPED_SYMBOL]) {
    return;
  }
  
  const originalFetch = window.fetch;
  
  window.fetch = async function wrappedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    const startTime = performance.now();
    
    const shouldSkip = ['/sse', '/health', '/favicon.ico', '/_next/static', '/static/'].some(
      (path) => url.includes(path)
    );
    
    if (shouldSkip) {
      return originalFetch.call(window, input, init);
    }
    
    try {
      const response = await originalFetch.call(window, input, init);
      const duration = performance.now() - startTime;
      
      Sentry.addBreadcrumb({
        category: 'fetch',
        message: `${method} ${url}`,
        level: response.ok ? 'info' : 'warning',
        data: {
          url,
          method,
          status: response.status,
          status_text: response.statusText,
          duration_ms: Math.round(duration),
          ok: response.ok,
        },
      });
      
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      Sentry.addBreadcrumb({
        category: 'fetch',
        message: `${method} ${url} - Failed`,
        level: 'error',
        data: {
          url,
          method,
          duration_ms: Math.round(duration),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      
      throw error;
    }
  };
  
  (window as any)[FETCH_WRAPPED_SYMBOL] = true;
}

/**
 * Add breadcrumb for user interaction
 */
export function logUserInteraction(
  action: string,
  target: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'ui.interaction',
    message: `${action}: ${target}`,
    level: 'info',
    data: {
      action,
      target,
      ...data,
    },
  });
}

/**
 * Add breadcrumb for navigation
 */
export function logNavigation(from: string, to: string): void {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigate: ${from} → ${to}`,
    level: 'info',
    data: {
      from,
      to,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Add breadcrumb for sidebar interaction
 */
export function logSidebarInteraction(action: string, item: string): void {
  Sentry.addBreadcrumb({
    category: 'ui.sidebar',
    message: `${action}: ${item}`,
    level: 'info',
    data: {
      action,
      item,
    },
  });
}
