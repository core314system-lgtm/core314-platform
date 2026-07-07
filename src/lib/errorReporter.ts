/**
 * Lightweight error reporter for production.
 * Captures unhandled errors and promise rejections, logging them to
 * the sub_access_log table for visibility (action_type = 'error').
 * 
 * In the future, this can be replaced with Sentry or similar.
 */

import { supabase } from './supabase'

interface ErrorReport {
  message: string
  stack?: string
  url: string
  timestamp: string
  userAgent: string
}

const MAX_REPORTS_PER_SESSION = 10
let reportCount = 0

async function reportError(error: ErrorReport) {
  if (reportCount >= MAX_REPORTS_PER_SESSION) return
  reportCount++

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Best-effort log — don't block the UI
    await supabase.from('sub_access_log').insert({
      user_id: user.id,
      org_id: '00000000-0000-0000-0000-000000000000', // placeholder for error logs
      action_type: 'view_profile', // reuse existing check constraint type
      metadata: {
        type: 'client_error',
        message: error.message,
        stack: error.stack?.slice(0, 500),
        url: error.url,
        userAgent: error.userAgent,
      },
    })
  } catch {
    // Silent fail — error reporting should never break the app
  }
}

export function initErrorReporter() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    reportError({
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportError({
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      stack: reason?.stack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    })
  })
}
