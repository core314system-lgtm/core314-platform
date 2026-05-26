/**
 * Sentry filters for noise reduction
 */

import * as Sentry from '@sentry/react';
import { IGNORED_ERROR_PATTERNS, DENIED_URL_PATTERNS, IGNORED_REQUEST_PATHS } from './config';

/**
 * beforeSend filter to drop noisy/useless errors
 */
export function beforeSendFilter(
  event: Sentry.ErrorEvent,
  hint: Sentry.EventHint
): Sentry.ErrorEvent | null {
  const requestUrl = event.request?.url || event.tags?.route;
  if (requestUrl && typeof requestUrl === 'string') {
    for (const path of IGNORED_REQUEST_PATHS) {
      if (requestUrl.includes(path)) {
        return null;
      }
    }
  }
  
  const hasException = event.exception?.values && event.exception.values.length > 0;
  const hasStacktrace = hasException && event.exception?.values?.some(
    (ex) => ex.stacktrace?.frames && ex.stacktrace.frames.length > 0
  );
  const hasMessage = event.message && event.message.trim().length > 0;
  
  if (!hasException && !hasStacktrace && !hasMessage) {
    return null;
  }
  
  if (!hasException && hasMessage) {
    const msg = event.message?.trim().toLowerCase();
    if (msg === 'undefined' || msg === 'null' || msg === '') {
      return null;
    }
  }
  
  const exceptionValue = event.exception?.values?.[0]?.value || '';
  const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames || [];
  const frameFilenames = stackFrames.map(f => f.filename || '').join(' ');
  const combinedText = `${exceptionValue} ${frameFilenames}`;
  
  for (const pattern of DENIED_URL_PATTERNS) {
    if (pattern.test(combinedText)) {
      return null;
    }
  }
  
  return event;
}

/**
 * Get the list of error patterns to ignore
 */
export function getIgnoreErrors(): (string | RegExp)[] {
  return [...IGNORED_ERROR_PATTERNS];
}

/**
 * Get the list of URL patterns to deny
 */
export function getDenyUrls(): RegExp[] {
  return [...DENIED_URL_PATTERNS];
}
