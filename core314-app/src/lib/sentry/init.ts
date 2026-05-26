/**
 * Main Sentry initialization
 * Centralizes all Sentry configuration for the user app
 * 
 * DSN is fetched at runtime from Netlify Function to prevent
 * sensitive values from being embedded in the client-side bundle.
 */

import * as Sentry from '@sentry/react';
import { SENTRY_CONFIG } from './config';
import { beforeSendFilter, getIgnoreErrors, getDenyUrls } from './filters';
import { getRelease, getBuildId, getEnvironment } from './release';
import { setGlobalTags, setDeviceMetrics, initLongTaskDetection } from './context';
import { wrapFetchWithBreadcrumbs } from './breadcrumbs';

interface SentryConfig {
  enabled: boolean;
  dsn?: string;
  environment?: string;
  message?: string;
}

/**
 * Fetch Sentry configuration from Netlify Function
 * This prevents DSN from being embedded in the client bundle
 */
async function fetchSentryConfig(): Promise<SentryConfig | null> {
  try {
    const response = await fetch('/.netlify/functions/get-sentry-config');
    if (!response.ok) {
      console.warn('Failed to fetch Sentry config:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('Error fetching Sentry config:', error);
    return null;
  }
}

/**
 * Initialize Sentry with runtime configuration
 */
function initializeSentry(dsn: string, environment: string): void {
  Sentry.init({
    dsn,
    release: getRelease(),
    environment: environment || getEnvironment(),
    
    ignoreErrors: getIgnoreErrors(),
    denyUrls: getDenyUrls(),
    beforeSend: beforeSendFilter,
    
    integrations: [
      Sentry.browserTracingIntegration({
        traceFetch: true,
        traceXHR: true,
      }),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      Sentry.captureConsoleIntegration({
        levels: ['error'],
      }),
    ],
    
    tracesSampleRate: SENTRY_CONFIG.TRACES_SAMPLE_RATE,
    replaysSessionSampleRate: SENTRY_CONFIG.REPLAYS_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: SENTRY_CONFIG.REPLAYS_ON_ERROR_SAMPLE_RATE,
    
    maxBreadcrumbs: SENTRY_CONFIG.MAX_BREADCRUMBS,
    
    normalizeDepth: 5,
    attachStacktrace: true,
  });
  
  setGlobalTags();
  
  Sentry.setTag('buildId', getBuildId());
  
  setDeviceMetrics();
  
  initLongTaskDetection();
  
  wrapFetchWithBreadcrumbs();
  
  console.info('Sentry initialized', {
    release: getRelease(),
    environment: environment || getEnvironment(),
    buildId: getBuildId(),
  });
}

/**
 * Initialize Sentry with all configurations
 * Fetches DSN at runtime from Netlify Function
 */
export async function initSentry(): Promise<void> {
  const config = await fetchSentryConfig();
  
  if (!config || !config.enabled || !config.dsn) {
    console.warn('Sentry DSN not configured, skipping initialization');
    return;
  }
  
  initializeSentry(config.dsn, config.environment || 'production');
}
