/**
 * Sentry context enrichment utilities
 * Adds tags, user context, and device/browser metrics
 */

import * as Sentry from '@sentry/react';
import { getBuildId, getEnvironment } from './release';

/**
 * Set global tags that apply to all events
 */
export function setGlobalTags(): void {
  Sentry.setTag('app', 'core314-app');
  Sentry.setTag('buildId', getBuildId());
  Sentry.setTag('environment', getEnvironment());
}

/**
 * Set user context from auth
 */
export function setUserContext(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Set organization/workspace context
 */
export function setWorkspaceContext(workspaceId: string, workspaceName?: string): void {
  Sentry.setTag('workspace_id', workspaceId);
  Sentry.setContext('workspace', {
    id: workspaceId,
    name: workspaceName,
  });
}

/**
 * Set integration count tag
 */
export function setIntegrationCount(count: number): void {
  Sentry.setTag('integration_count', count.toString());
}

/**
 * Set active integrations context
 */
export function setIntegrationsContext(integrations: string[]): void {
  Sentry.setContext('integrations', {
    active: integrations,
    count: integrations.length,
  });
}

/**
 * Set current route context
 */
export function setRouteContext(route: string): void {
  Sentry.setTag('route', route);
  Sentry.setContext('navigation', {
    current_route: route,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Set feature flags context
 */
export function setFeatureFlagsContext(flags: Record<string, boolean>): void {
  Sentry.setContext('feature_flags', flags);
}

/**
 * Collect and set device/browser metrics
 */
export function setDeviceMetrics(): void {
  try {
    if (navigator.hardwareConcurrency) {
      Sentry.setTag('device_cores', navigator.hardwareConcurrency.toString());
    }
    
    // @ts-ignore - navigator.connection is experimental
    if (navigator.connection?.effectiveType) {
      // @ts-ignore
      Sentry.setTag('connection_type', navigator.connection.effectiveType);
    }
    
    // @ts-ignore - navigator.deviceMemory is experimental
    if (navigator.deviceMemory) {
      // @ts-ignore
      Sentry.setTag('device_memory_gb', navigator.deviceMemory.toString());
    }
    
    const deviceContext: Record<string, unknown> = {
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      pixel_ratio: window.devicePixelRatio,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
    };
    
    // @ts-ignore - performance.memory is Chromium-only
    if (performance.memory) {
      // @ts-ignore
      deviceContext.memory_limit_mb = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
      // @ts-ignore
      deviceContext.memory_used_mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
    }
    
    // @ts-ignore - navigator.connection is experimental
    if (navigator.connection) {
      // @ts-ignore
      deviceContext.connection_downlink = navigator.connection.downlink;
      // @ts-ignore
      deviceContext.connection_rtt = navigator.connection.rtt;
    }
    
    Sentry.setContext('device', deviceContext);
  } catch (error) {
    console.warn('Failed to collect device metrics:', error);
  }
}

/**
 * Initialize long task detection
 * Logs breadcrumbs for tasks > 100ms
 */
export function initLongTaskDetection(): void {
  try {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 100) {
            Sentry.addBreadcrumb({
              category: 'performance',
              message: `Long task detected: ${Math.round(entry.duration)}ms`,
              level: 'warning',
              data: {
                duration: entry.duration,
                start_time: entry.startTime,
                name: entry.name,
              },
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['longtask'] });
    }
  } catch (error) {
    console.warn('Long task detection not supported:', error);
  }
}
