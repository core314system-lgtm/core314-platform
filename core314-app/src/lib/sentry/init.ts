/**
 * Main Sentry initialization
 * Centralizes all Sentry configuration for the user app
 */

import * as Sentry from '@sentry/react';
import { SENTRY_CONFIG } from './config';
import { beforeSendFilter, getIgnoreErrors, getDenyUrls } from './filters';
import { getRelease, getBuildId, getEnvironment } from './release';
import { setGlobalTags, setDeviceMetrics, initLongTaskDetection } from './context';
import { wrapFetchWithBreadcrumbs } from './breadcrumbs';

/**
 * Initialize Sentry with all configurations
 */
export function initSentry(): void {
  const dsn = import.meta.env.SENTRY_DSN_APP;
  
  if (!dsn) {
    console.warn('Sentry DSN not configured, skipping initialization');
    return;
  }
  
  Sentry.init({
    dsn,
    release: getRelease(),
    environment: getEnvironment(),
    
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
  
  console.info('✅ Sentry initialized', {
    release: getRelease(),
    environment: getEnvironment(),
    buildId: getBuildId(),
  });
}
