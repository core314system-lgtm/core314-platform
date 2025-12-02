# Sentry Integration for Core314 Beta Testing

This document describes the comprehensive Sentry monitoring integration implemented across the Core314 platform for beta testing.

## Overview

Sentry monitoring has been integrated across three key areas:
1. **core314-app** (User-facing application)
2. **core314-admin** (Admin dashboard)
3. **ALL 131 Supabase Edge Functions**

## Environment Variables Required

### Netlify (for React Apps)

Add these environment variables in Netlify dashboard for both `core314-app` and `core314-admin`:

```bash
# For core314-app
SENTRY_DSN_APP=<your-sentry-dsn-for-app>
SENTRY_ENVIRONMENT=beta-test

# For core314-admin
SENTRY_DSN_ADMIN=<your-sentry-dsn-for-admin>
SENTRY_ENVIRONMENT=beta-test

# Optional: For source map uploads (both apps)
SENTRY_ORG=<your-sentry-org>
SENTRY_PROJECT=<your-sentry-project-name>
SENTRY_AUTH_TOKEN=<your-sentry-auth-token>
```

### Supabase (for Edge Functions)

Add these secrets in Supabase dashboard → Project Settings → Edge Functions:

```bash
SENTRY_DSN_EDGE=<your-sentry-dsn-for-edge-functions>
SENTRY_ENVIRONMENT=beta-test
```

## Features Implemented

### React Apps (core314-app & core314-admin)

1. **Error Boundary**: Wraps the entire app to catch React rendering errors
2. **Performance Tracing**: 20% sampling rate to monitor performance
3. **Session Replay**: 10% of sessions, 100% of error sessions
4. **Console Error Capture**: Automatically captures console.error() calls
5. **Custom Error Fallback UI**: User-friendly error page with refresh button
6. **Test Endpoints**: `/sentry-test` route for manual testing (admin only)

### Edge Functions (All 131 Functions)

1. **withSentry Wrapper**: Automatic error tracking for all function invocations
2. **Breadcrumbs**: Automatic logging for:
   - HTTP requests and responses
   - Supabase queries
   - Stripe API calls
   - OpenAI API requests
   - Anomaly detection events
   - Optimization engine triggers
   - Billing workflow events
3. **Request Context**: Captures user_id, function_name, request_id, headers
4. **Test Endpoint**: Special header `x-sentry-test: 1` triggers test event

## Testing Sentry Integration

### Testing React Apps

1. **User App** (core314-app):
   - Navigate to `/sentry-test` (requires admin access)
   - Click test buttons to trigger different event types
   - Verify events appear in Sentry dashboard

2. **Admin App** (core314-admin):
   - Navigate to `/sentry-test`
   - Click test buttons to trigger different event types
   - Verify events appear in Sentry dashboard

### Testing Edge Functions

Use the Supabase client to invoke any Edge Function with the test header:

```javascript
const { data, error } = await supabase.functions.invoke('function-name', {
  headers: {
    'x-sentry-test': '1'
  }
});
```

This will:
- Trigger a test exception
- Send it to Sentry
- Return `{ ok: true, message: 'Sentry test event sent' }`

### Verifying in Sentry Dashboard

1. Go to your Sentry dashboard
2. Select the appropriate project (app, admin, or edge)
3. Navigate to **Issues** tab
4. You should see test events with:
   - Full stack traces
   - Breadcrumbs showing the sequence of events
   - Context (user, environment, tags)
   - Request details

## Files Modified

### React Apps
- `core314-app/vite.config.ts` - Added env var mappings
- `core314-app/src/main.tsx` - Sentry initialization + ErrorBoundary
- `core314-app/src/App.tsx` - Added /sentry-test route
- `core314-app/src/pages/SentryTest.tsx` - Test page (new)
- `core314-admin/vite.config.ts` - Added env var mappings
- `core314-admin/src/main.tsx` - Sentry initialization + ErrorBoundary
- `core314-admin/src/App.tsx` - Added /sentry-test route
- `core314-admin/src/pages/SentryTest.tsx` - Test page (new)

### Edge Functions
- `core314-app/supabase/functions/_shared/sentry.ts` - Shared Sentry utility (enhanced)
- **128 Edge Function index.ts files** - All instrumented with withSentry wrapper

### Scripts
- `scripts/instrument-edge-functions-sentry.mjs` - Automation script for instrumentation

## Instrumented Edge Functions

All 131 Edge Functions have been instrumented with Sentry monitoring:

- 128 functions automatically instrumented
- 3 functions were already instrumented
- 0 errors during instrumentation

Full list available in git diff.

## Breadcrumb Usage Examples

### In Edge Functions

```typescript
import { breadcrumb } from "../_shared/sentry.ts";

// Supabase query
breadcrumb.supabase("fetch user profile", { user_id });

// Stripe API call
breadcrumb.stripe("create customer", 200, { customer_id });

// OpenAI API call
breadcrumb.openai("chat/completions", 200, "gpt-4o-mini");

// Anomaly detection
breadcrumb.anomaly("High error rate detected", "high");

// Optimization trigger
breadcrumb.optimization("Auto-scaling triggered", { instances: 3 });

// Billing event
breadcrumb.billing("Subscription upgraded", { plan: "pro" });

// Custom breadcrumb
breadcrumb.custom("custom-category", "Custom event", { key: "value" });
```

## Performance Considerations

- **Trace Sampling**: 20% of requests are traced (reduces volume)
- **Session Replay**: 10% of normal sessions, 100% of error sessions
- **Breadcrumbs**: Automatically added but don't impact performance
- **Error Flushing**: 2-second timeout ensures events are sent before function termination

## Disabling Sentry

To disable Sentry monitoring:

1. **React Apps**: Remove or unset `SENTRY_DSN_APP` and `SENTRY_DSN_ADMIN` environment variables
2. **Edge Functions**: Remove or unset `SENTRY_DSN_EDGE` secret

The code is designed to gracefully handle missing DSN values and will simply skip Sentry initialization.

## Troubleshooting

### Events Not Appearing in Sentry

1. Verify environment variables are set correctly
2. Check that DSN values are valid
3. Ensure Sentry project exists and is active
4. Check browser console / Edge Function logs for Sentry errors
5. Verify network connectivity to Sentry (sentry.io)

### Source Maps Not Uploading

1. Verify `SENTRY_AUTH_TOKEN` is set
2. Check `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry configuration
3. Review build logs for Sentry plugin errors
4. Ensure `@sentry/vite-plugin` is installed

### Edge Function Errors

1. Verify `SENTRY_DSN_EDGE` is set in Supabase secrets
2. Check Edge Function logs for Sentry initialization errors
3. Ensure Deno has network access to sentry.io
4. Verify Sentry SDK version is compatible with Deno runtime

## Support

For issues with Sentry integration:
1. Check Sentry documentation: https://docs.sentry.io
2. Review this document for configuration details
3. Test using the `/sentry-test` endpoints
4. Check Sentry dashboard for quota limits

## Next Steps

After verifying Sentry is working:
1. Set up alert rules in Sentry dashboard
2. Configure issue assignment and notifications
3. Set up performance monitoring thresholds
4. Review and adjust sampling rates based on volume
5. Create custom dashboards for beta metrics
