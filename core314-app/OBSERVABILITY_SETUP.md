# Core314 Observability Setup Guide

## Overview

This document describes how to set up error tracking, metrics, and alerting for the Core314 platform.

## Sentry Integration

### Prerequisites

1. Create a Sentry account at https://sentry.io
2. Create three projects:
   - `core314-user-app` (React frontend)
   - `core314-admin-app` (React frontend)
   - `core314-edge-functions` (Serverless backend)

### Environment Variables Required

Add these to your deployment environments:

**User App (Netlify):**
```
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Admin App (Netlify):**
```
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Supabase Edge Functions:**
```
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Netlify Functions (Landing Page):**
```
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Installation Steps

#### 1. User App Frontend

```bash
cd /home/ubuntu/repos/core314-platform/core314-app
npm install @sentry/react @sentry/vite-plugin
```

Add to `src/main.tsx`:

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

#### 2. Admin App Frontend

Same as User App - add Sentry initialization to admin app's main entry point.

#### 3. Supabase Edge Functions

Add to each critical Edge Function (fusion_ai_gateway, ai_data_context, etc.):

```typescript
import * as Sentry from 'https://deno.land/x/sentry@7.77.0/index.mjs';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: 'production',
  tracesSampleRate: 1.0,
});

// Wrap handler
Deno.serve(async (req) => {
  try {
    // ... your handler code
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
});
```

#### 4. Netlify Functions

```bash
cd /home/ubuntu/core314-landing
npm install @sentry/node
```

Add to each function:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 1.0,
});

export const handler: Handler = async (event) => {
  try {
    // ... your handler code
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  } finally {
    await Sentry.flush(2000);
  }
};
```

## Health Endpoint

The `/api/health` endpoint is now available at:
- https://core314.com/api/health

It returns:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-18T20:25:00.000Z",
  "uptime_seconds": 3600,
  "errors_24h": 0,
  "fusion_score_avg": 87.5,
  "response_time_ms": 45,
  "version": "1.0-GA-RC1"
}
```

### Monitoring Recommendations

1. **Uptime Monitoring**: Use UptimeRobot or Pingdom to monitor `/api/health` every 5 minutes
2. **Alert on**:
   - Status != "healthy"
   - errors_24h > 100
   - fusion_score_avg < 50
   - response_time_ms > 1000

## Alerting

### Option 1: Sentry Alerts

Configure in Sentry Dashboard:
- Alert on error rate > 10/minute
- Alert on new error types
- Alert on performance degradation

### Option 2: Netlify Log Drains

1. Install Logflare plugin in Netlify
2. Configure alerts for:
   - 5xx error rate > 5%
   - Function timeout rate > 1%
   - Build failures

### Option 3: PostHog

1. Add PostHog to landing page
2. Track key events:
   - Signup completions
   - Payment failures
   - AI query errors
3. Set up alerts in PostHog dashboard

## Metrics Dashboard

### Key Metrics to Track

**System Health:**
- API response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database query performance
- Edge Function cold starts

**Business Metrics:**
- Daily active users
- AI queries per day
- Quota utilization by tier
- Conversion rate (trial → paid)

**AI Metrics:**
- AI query latency
- OpenAI API errors
- Quota exceeded events
- Average tokens per request

### Recommended Tools

- **Sentry Performance**: Built-in with Sentry integration
- **Supabase Dashboard**: Database metrics and logs
- **Netlify Analytics**: Function performance and errors
- **Custom Dashboard**: Build with Grafana + Prometheus (optional)

## Incident Response

### Runbooks

Create runbooks for common scenarios:

1. **Database Connection Failures**
   - Check Supabase status page
   - Verify connection pool settings
   - Restart affected Edge Functions

2. **AI Query Failures**
   - Check OpenAI API status
   - Verify API key validity
   - Check quota limits

3. **Payment Processing Errors**
   - Check Stripe Dashboard
   - Verify webhook signature
   - Check Supabase profile updates

4. **High Error Rate**
   - Check Sentry for error patterns
   - Review recent deployments
   - Check /api/health endpoint
   - Review database logs

### On-Call Rotation

Set up PagerDuty or similar with:
- Primary on-call engineer
- Secondary escalation
- Integration with Sentry alerts
- Integration with uptime monitoring

## Testing

### Verify Sentry Integration

1. Add a test error endpoint:
```typescript
// Test endpoint - remove after verification
app.get('/api/test-error', () => {
  throw new Error('Test Sentry integration');
});
```

2. Trigger the error
3. Verify it appears in Sentry dashboard
4. Remove test endpoint

### Verify Health Endpoint

```bash
curl https://core314.com/api/health
```

Expected response: 200 OK with health metrics

## Next Steps

1. ✅ Health endpoint created
2. ⏸️ Obtain Sentry DSNs (3 projects)
3. ⏸️ Install Sentry SDKs
4. ⏸️ Configure Sentry in all apps
5. ⏸️ Set up uptime monitoring
6. ⏸️ Configure alerting rules
7. ⏸️ Create incident runbooks
8. ⏸️ Test error capture end-to-end

## Status

**Current State**: Health endpoint implemented, Sentry integration documented

**Blocked On**: Sentry DSN credentials from user

**Priority**: P0 for GA launch
