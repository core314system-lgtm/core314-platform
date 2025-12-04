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
  console.log('🔍 SENTRY INIT START');
  
  const dsn = import.meta.env.VITE_SENTRY_DSN || import.meta.env.SENTRY_DSN_APP;
  const environment = import.meta.env.VITE_ENVIRONMENT || import.meta.env.SENTRY_ENVIRONMENT || 'beta-test';
  
  console.log('🔍 Sentry Config Check:', {
    dsnSource: import.meta.env.VITE_SENTRY_DSN ? 'VITE_SENTRY_DSN' : 
                import.meta.env.SENTRY_DSN_APP ? 'SENTRY_DSN_APP' : 'NONE',
    dsnHost: dsn ? new URL(dsn).host : 'UNDEFINED',
    environment,
    replayEnabled: true,
    buildId: getBuildId(),
  });
  
  if (!dsn) {
    console.error('❌ Sentry DSN not configured - checked VITE_SENTRY_DSN and SENTRY_DSN_APP');
    console.error('Available env vars:', {
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
      SENTRY_DSN_APP: import.meta.env.SENTRY_DSN_APP,
      VITE_ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT,
      SENTRY_ENVIRONMENT: import.meta.env.SENTRY_ENVIRONMENT,
    });
    return;
  }
  
  Sentry.init({
    dsn,
    release: getRelease(),
    environment,
    
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
  
  console.info('✅ Sentry initialized successfully', {
    dsn: dsn.substring(0, 30) + '...',
    dsnHost: new URL(dsn).host,
    release: getRelease(),
    environment,
    buildId: getBuildId(),
    tracesSampleRate: SENTRY_CONFIG.TRACES_SAMPLE_RATE,
    replaysSessionSampleRate: SENTRY_CONFIG.REPLAYS_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: SENTRY_CONFIG.REPLAYS_ON_ERROR_SAMPLE_RATE,
  });
}
