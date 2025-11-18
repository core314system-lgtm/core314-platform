import * as Sentry from 'https://deno.land/x/sentry@7.119.0/index.mjs'

let sentryInitialized = false

export function initSentry() {
  if (sentryInitialized) return
  
  const dsn = Deno.env.get('SENTRY_DSN')
  if (!dsn) {
    console.warn('SENTRY_DSN not configured, error tracking disabled')
    return
  }

  Sentry.init({
    dsn,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
    tracesSampleRate: 1.0,
  })
  
  sentryInitialized = true
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (!sentryInitialized) return
  
  Sentry.captureException(error, {
    extra: context,
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!sentryInitialized) return
  
  Sentry.captureMessage(message, level)
}
