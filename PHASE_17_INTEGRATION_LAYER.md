# Phase 17: Dynamic Integration Layer

## Overview

The Dynamic Integration Layer connects Core314's Fusion & Scoring Intelligence Layer with external systems (Stripe, Microsoft Teams, and Slack). This layer manages real-time synchronization, event triggers, and data routing for user actions and AI-driven automation.

## Architecture

### Components

1. **Integration Events Table** (`integration_events`)
   - Logs all integration events from external systems
   - Fields: id, service_name, event_type, payload (jsonb), user_id, created_at
   - RLS enabled: Only platform admins can view events
   - Server-side functions bypass RLS for inserts

2. **Shared Utilities** (`_shared/integration-utils.ts`)
   - `logEvent()` - Log events to integration_events table
   - `requireAdmin()` - Verify platform admin authentication
   - `postToTeams()` - Send messages to Microsoft Teams webhook
   - `postToSlack()` - Send messages to Slack webhook
   - `createAdminClient()` - Create Supabase client with service role
   - `createUserClient()` - Create Supabase client from user JWT
   - `verifyInternalToken()` - Verify internal webhook token for mock mode

3. **Edge Functions**
   - `stripe-webhook` - Handles Stripe events (mock mode with internal token)
   - `teams-alert` - Sends alerts to Microsoft Teams (admin-only)
   - `slack-alert` - Sends alerts to Slack (admin-only)
   - `integration-events-list` - Retrieves and filters integration events (admin-only)

## Setup

### Environment Variables

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
# Required for all functions
SUPABASE_URL=https://ygvkegcstaowikessigx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>

# For Stripe webhook (mock mode)
INTERNAL_WEBHOOK_TOKEN=<generate-a-secure-random-token>
STRIPE_API_KEY=<placeholder-for-future-live-mode>

# For Teams and Slack alerts
MICROSOFT_TEAMS_WEBHOOK_URL=<your-teams-webhook-url>
SLACK_WEBHOOK_URL=<your-slack-webhook-url>
```

### Database Migration

Apply the migration to create the integration_events table:

```bash
# Run in Supabase SQL Editor
# File: core314-app/supabase/migrations/032_integration_events.sql
```

Or apply programmatically:

```bash
cd core314-app
supabase db push
```

### Deploy Edge Functions

```bash
cd core314-app

# Deploy all integration functions
supabase functions deploy stripe-webhook --project-ref ygvkegcstaowikessigx
supabase functions deploy teams-alert --project-ref ygvkegcstaowikessigx
supabase functions deploy slack-alert --project-ref ygvkegcstaowikessigx
supabase functions deploy integration-events-list --project-ref ygvkegcstaowikessigx
```

## Usage

### 1. Stripe Webhook (Mock Mode)

**Endpoint:** `https://ygvkegcstaowikessigx.supabase.co/functions/v1/stripe-webhook`

**Authentication:** Internal webhook token (Bearer token)

**Example Request:**

```bash
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/stripe-webhook \
  -H "Authorization: Bearer YOUR_INTERNAL_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_test_123",
    "type": "invoice.paid",
    "data": {
      "object": {
        "id": "in_test_123",
        "customer": "cus_test_123",
        "amount_paid": 2999,
        "currency": "usd"
      }
    },
    "created": 1699123456
  }'
```

**Response:**

```json
{
  "success": true,
  "event_id": "evt_test_123",
  "event_type": "invoice.paid",
  "user_id": "uuid-or-null",
  "logged": true
}
```

**Supported Mock Events:**
- `invoice.paid` - Invoice payment successful
- `invoice.payment_failed` - Invoice payment failed
- `subscription.created` - New subscription created
- `subscription.updated` - Subscription updated
- `subscription.deleted` - Subscription canceled
- `customer.created` - New customer created
- `customer.updated` - Customer information updated

### 2. Microsoft Teams Alert

**Endpoint:** `https://ygvkegcstaowikessigx.supabase.co/functions/v1/teams-alert`

**Authentication:** Supabase JWT (platform admin only)

**Example Request:**

```bash
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/teams-alert \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "System Alert",
    "message": "High priority: User subscription payment failed",
    "user_id": "optional-user-uuid"
  }'
```

**Response:**

```json
{
  "success": true,
  "service": "teams",
  "message": "Alert sent successfully"
}
```

### 3. Slack Alert

**Endpoint:** `https://ygvkegcstaowikessigx.supabase.co/functions/v1/slack-alert`

**Authentication:** Supabase JWT (platform admin only)

**Example Request:**

```bash
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/slack-alert \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "System Alert",
    "message": "High priority: User subscription payment failed",
    "user_id": "optional-user-uuid"
  }'
```

**Response:**

```json
{
  "success": true,
  "service": "slack",
  "message": "Alert sent successfully"
}
```

### 4. Integration Events List

**Endpoint:** `https://ygvkegcstaowikessigx.supabase.co/functions/v1/integration-events-list`

**Authentication:** Supabase JWT (platform admin only)

**Query Parameters:**
- `service_name` (optional) - Filter by service (stripe, teams, slack)
- `event_type` (optional) - Filter by event type
- `user_id` (optional) - Filter by user ID
- `limit` (optional, default: 50, max: 1000) - Number of events to return
- `offset` (optional, default: 0) - Pagination offset

**Example Request:**

```bash
curl -X GET "https://ygvkegcstaowikessigx.supabase.co/functions/v1/integration-events-list?service_name=stripe&limit=10" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

**Response:**

```json
{
  "success": true,
  "events": [
    {
      "id": "uuid",
      "service_name": "stripe",
      "event_type": "invoice.paid",
      "payload": { ... },
      "user_id": "uuid-or-null",
      "created_at": "2025-11-05T04:00:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0
  },
  "filters": {
    "service_name": "stripe",
    "event_type": null,
    "user_id": null
  },
  "summary": {
    "services": {
      "stripe": 25,
      "teams": 10,
      "slack": 7
    },
    "event_types": {
      "invoice.paid": 15,
      "alert.sent": 17,
      "subscription.created": 10
    }
  }
}
```

## Fusion & Scoring Intelligence Integration

When integration events are received, the system automatically:

1. **Logs the event** to `integration_events` table
2. **Maps user_id** from external identifiers (e.g., Stripe customer_id → profiles.stripe_customer_id)
3. **Triggers fusion recalculation** by calling the `fusion-recalibrate` edge function for affected integrations
4. **Updates fusion scores** in the `fusion_scores` table
5. **Propagates changes** through the Fusion & Scoring Intelligence Layer

### Fusion Recalculation Flow

```
External Event (Stripe/Teams/Slack)
  ↓
stripe-webhook / teams-alert / slack-alert
  ↓
Log to integration_events table
  ↓
Identify user_id (if applicable)
  ↓
Get user's active integrations
  ↓
Call fusion-recalibrate for each integration
  ↓
Update fusion_scores and fusion_metrics
  ↓
Trigger AI insights generation (if configured)
```

## Activating Live Stripe Integration

Currently, the Stripe webhook operates in **mock mode** for testing. To activate live Stripe integration:

### 1. Update Environment Variables

```bash
# In Supabase Dashboard → Edge Functions → Secrets
# Remove INTERNAL_WEBHOOK_TOKEN (or keep for testing)
# Add live Stripe keys
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Update stripe-webhook Function

Replace the internal token verification with Stripe signature verification:

```typescript
// In stripe-webhook/index.ts
// Replace verifyInternalToken() with:

import Stripe from 'https://esm.sh/stripe@14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') || '', {
  apiVersion: '2023-10-16',
});

// In the serve handler:
const signature = req.headers.get('stripe-signature');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

if (!signature || !webhookSecret) {
  return new Response('Webhook signature verification failed', { status: 401 });
}

const body = await req.text();
let event: Stripe.Event;

try {
  event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
} catch (err) {
  console.error('Webhook signature verification failed:', err);
  return new Response('Webhook signature verification failed', { status: 401 });
}

// Continue with event processing...
```

### 3. Configure Stripe Dashboard

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://ygvkegcstaowikessigx.supabase.co/functions/v1/stripe-webhook`
3. Select events to listen for:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.deleted`
   - `customer.created`
   - `customer.updated`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 4. Redeploy Function

```bash
supabase functions deploy stripe-webhook --project-ref ygvkegcstaowikessigx
```

## Adding New Integrations

The integration layer is designed to be modular and extensible. To add a new integration:

### 1. Create Edge Function

```bash
mkdir -p supabase/functions/new-integration-webhook
```

### 2. Implement Handler

```typescript
// supabase/functions/new-integration-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createAdminClient,
  logEvent,
  // Add other utilities as needed
} from '../_shared/integration-utils.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication (webhook signature, JWT, etc.)
    // 2. Parse event data
    // 3. Map to user_id if applicable
    // 4. Log event to integration_events
    // 5. Trigger fusion recalculation
    // 6. Return success response

    const supabaseAdmin = createAdminClient();
    
    await logEvent(supabaseAdmin, {
      service_name: 'new-service',
      event_type: 'event.type',
      payload: { /* event data */ },
      user_id: userId,
    });

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### 3. Deploy Function

```bash
supabase functions deploy new-integration-webhook --project-ref ygvkegcstaowikessigx
```

### 4. Update Documentation

Add the new integration to this document with usage examples.

## Disabling Integrations

To temporarily disable an integration without removing the code:

### Option 1: Remove Environment Variables

Remove the webhook URL or API key from Supabase secrets. The function will return an error when called.

### Option 2: Add Feature Flag

Add a feature flag check in the edge function:

```typescript
const enabled = Deno.env.get('ENABLE_STRIPE_WEBHOOK') === 'true';
if (!enabled) {
  return new Response(
    JSON.stringify({ error: 'Integration disabled' }),
    { status: 503, headers: corsHeaders }
  );
}
```

### Option 3: Remove Webhook Configuration

Remove the webhook URL from the external service (Stripe Dashboard, Teams/Slack settings).

## Testing

### Test Stripe Webhook (Mock Mode)

```bash
# Generate a test token
export INTERNAL_WEBHOOK_TOKEN="test-token-$(date +%s)"

# Set in Supabase secrets
# Then test:
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/stripe-webhook \
  -H "Authorization: Bearer $INTERNAL_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_test_'$(date +%s)'",
    "type": "invoice.paid",
    "data": {
      "object": {
        "id": "in_test_123",
        "customer": "cus_test_123",
        "amount_paid": 2999
      }
    }
  }'
```

### Test Teams/Slack Alerts

```bash
# Get admin JWT from Supabase Auth
export ADMIN_JWT="your-admin-jwt"

# Test Teams
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/teams-alert \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Alert",
    "message": "This is a test message from Core314"
  }'

# Test Slack
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/slack-alert \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Alert",
    "message": "This is a test message from Core314"
  }'
```

### Verify Event Logs

```bash
# List all events
curl -X GET "https://ygvkegcstaowikessigx.supabase.co/functions/v1/integration-events-list" \
  -H "Authorization: Bearer $ADMIN_JWT"

# Filter by service
curl -X GET "https://ygvkegcstaowikessigx.supabase.co/functions/v1/integration-events-list?service_name=stripe" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

## Security Considerations

1. **Service Role Key**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code
2. **Webhook Tokens**: Use strong, randomly generated tokens for `INTERNAL_WEBHOOK_TOKEN`
3. **Stripe Signatures**: Always verify Stripe webhook signatures in production
4. **Admin-Only Access**: Teams/Slack alerts and event listing require platform admin authentication
5. **RLS Policies**: integration_events table has RLS enabled - only admins can view
6. **HTTPS Only**: All webhook endpoints must use HTTPS
7. **Rate Limiting**: Consider adding rate limiting for webhook endpoints
8. **Idempotency**: Stripe events can be delivered multiple times - consider deduplication

## Troubleshooting

### Events Not Logging

1. Check Supabase function logs: `supabase functions logs stripe-webhook`
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. Confirm migration 032 was applied successfully
4. Check RLS policies on integration_events table

### Teams/Slack Alerts Not Sending

1. Verify webhook URLs are correct and active
2. Test webhook URLs directly with curl
3. Check function logs for error messages
4. Confirm admin authentication is working

### Fusion Scores Not Updating

1. Verify `fusion-recalibrate` function exists and is deployed
2. Check that user has active integrations in `user_integrations` table
3. Confirm user_id mapping is working correctly
4. Review fusion-recalibrate function logs

## Next Steps: Phase 18

After successful deployment and testing of Phase 17, prepare for:

**Phase 18 - RLS Audit and Verification Script Implementation**

This will include:
- Comprehensive RLS policy audit across all tables
- Automated verification scripts
- Security compliance reporting
- Policy optimization recommendations

## Support

For issues or questions:
- Review function logs in Supabase Dashboard
- Check integration_events table for event history
- Verify environment variables are set correctly
- Consult Fusion & Scoring Intelligence Layer documentation
