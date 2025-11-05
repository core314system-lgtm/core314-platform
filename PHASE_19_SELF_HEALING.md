# Phase 19: Fusion & Integration Self-Healing Layer

## Overview

Automated system that monitors integration health, diagnoses root causes of failures, and performs AI-assisted recovery actions. This layer acts as a resilient orchestrator that prevents integration failures from cascading and automatically resolves common issues.

## Architecture

### Triggering Model (Dual-Mode)

1. **Webhook Mode (Primary)**: Integration functions POST failure reports directly to `/integration-self-heal` on error
   - Fastest time-to-recover (immediate)
   - No polling lag
   - Direct error context available

2. **Scan Mode (Secondary)**: Scheduled backlog sweep via GitHub Actions
   - Runs every 15 minutes
   - Picks up stragglers and network blips
   - Processes pending failures from integration_events
   - Handles delayed retries (e.g., after rate limit cooldown)

### Data Flow

```
Integration Function Error
    ↓
1. Log to integration_events (status='error')
2. POST to /integration-self-heal (webhook mode)
    ↓
Analyzer (deterministic + optional LLM)
    ↓
Category: auth | rate_limit | network | data | unknown
    ↓
Recovery Strategy
    ↓
Monitor (execute recovery)
    ↓
Log to system_integrity_events
    ↓
Notify admins (Teams/Slack)
```

## Database Schema

### system_integrity_events Table

```sql
CREATE TABLE system_integrity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,  -- Reference to integration_events.id
  service_name TEXT NOT NULL,
  failure_reason TEXT,
  failure_category TEXT,  -- 'auth', 'rate_limit', 'network', 'data', 'unknown'
  action_taken TEXT,
  analyzer_signals JSONB,  -- Diagnostic details from analyzer
  llm_reasoning TEXT,  -- Optional AI reasoning if useLLM=true
  status TEXT CHECK (status IN ('pending', 'resolved', 'disabled')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_integrity_events_service_status 
  ON system_integrity_events(service_name, status, created_at DESC);
CREATE INDEX idx_system_integrity_events_event_id 
  ON system_integrity_events(event_id);
CREATE INDEX idx_system_integrity_events_category 
  ON system_integrity_events(failure_category, created_at DESC);
```

### integration_events Table Updates

Add new columns to existing table:

```sql
ALTER TABLE integration_events 
  ADD COLUMN status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'pending'));
ALTER TABLE integration_events 
  ADD COLUMN error_code TEXT;
ALTER TABLE integration_events 
  ADD COLUMN error_message TEXT;
ALTER TABLE integration_events 
  ADD COLUMN http_status INTEGER;
ALTER TABLE integration_events 
  ADD COLUMN retry_count INTEGER DEFAULT 0;

CREATE INDEX idx_integration_events_status_created 
  ON integration_events(status, created_at DESC);
```

### integrations_master Table Updates

Add OAuth token storage:

```sql
ALTER TABLE integrations_master
  ADD COLUMN oauth_config JSONB;  -- {token_url, client_id, client_secret, scopes}
ALTER TABLE integrations_master
  ADD COLUMN recovery_fail_count INTEGER DEFAULT 0;
ALTER TABLE integrations_master
  ADD COLUMN last_recovery_at TIMESTAMPTZ;
ALTER TABLE integrations_master
  ADD COLUMN auto_recovery_enabled BOOLEAN DEFAULT true;
```

### user_integrations Table Updates

Add token storage with RLS:

```sql
ALTER TABLE user_integrations
  ADD COLUMN access_token TEXT;
ALTER TABLE user_integrations
  ADD COLUMN refresh_token TEXT;
ALTER TABLE user_integrations
  ADD COLUMN token_expires_at TIMESTAMPTZ;
ALTER TABLE user_integrations
  ADD COLUMN last_error_at TIMESTAMPTZ;
ALTER TABLE user_integrations
  ADD COLUMN consecutive_failures INTEGER DEFAULT 0;
```

## API Interfaces

### POST /integration-self-heal (Webhook Mode)

**Request:**
```typescript
{
  mode: 'webhook',
  event_id: string,  // UUID from integration_events
  service_name: string,  // 'slack', 'teams', 'stripe', etc.
  http_status: number,
  error_code?: string,
  error_message: string,
  payload?: Record<string, any>,  // Sanitized (no secrets)
  endpoint?: string,
  retry_count: number,
  user_id?: string
}
```

**Response:**
```typescript
{
  success: boolean,
  recovery_id: string,  // system_integrity_events.id
  category: 'auth' | 'rate_limit' | 'network' | 'data' | 'unknown',
  action_taken: string,
  status: 'resolved' | 'pending' | 'disabled',
  retry_scheduled?: boolean,
  next_retry_at?: string
}
```

### POST /integration-self-heal?mode=scan (Scan Mode)

**Request:**
```typescript
{
  mode: 'scan',
  window_minutes?: number,  // Default: 15
  limit?: number  // Default: 50
}
```

**Response:**
```typescript
{
  success: boolean,
  processed_count: number,
  resolved_count: number,
  pending_count: number,
  disabled_count: number,
  events: Array<{
    event_id: string,
    service_name: string,
    category: string,
    action_taken: string,
    status: string
  }>
}
```

## Failure Categories & Recovery Strategies

### 1. Auth Failures
**Detection:**
- HTTP 401, 403
- Error codes: `invalid_grant`, `invalid_token`, `token_expired`, `unauthorized`

**Recovery:**
1. Check if OAuth2 integration (has refresh_token)
2. Call token refresh utility: `refreshOAuthToken(service_name, user_id)`
3. Retry original request with new token (max 3 attempts)
4. If refresh fails → mark as 'pending', notify admin

**Disable Threshold:** 3 consecutive auth failures after refresh attempts

### 2. Rate Limit Failures
**Detection:**
- HTTP 429
- Error codes: `rate_limit_exceeded`, `too_many_requests`
- Headers: `Retry-After`, `X-RateLimit-Reset`

**Recovery:**
1. Parse `Retry-After` header (seconds or HTTP date)
2. If < 10 seconds → short backoff retry (500ms, 1s, 2s)
3. If > 10 seconds → mark as 'pending', schedule delayed retry
4. Log rate limit details for monitoring

**Disable Threshold:** Never (rate limits are temporary)

### 3. Network Failures
**Detection:**
- HTTP 408, 500, 502, 503, 504
- Error codes: `ENOTFOUND`, `ECONNRESET`, `ETIMEDOUT`, `network_error`

**Recovery:**
1. Retry with exponential backoff: 500ms, 1s, 2s (max 3 attempts)
2. Add jitter: `delay * (0.5 + Math.random() * 0.5)`
3. If all retries fail → mark as 'pending'
4. Scan mode will retry later

**Disable Threshold:** 9 failures in 60 minutes

### 4. Data/Validation Failures
**Detection:**
- HTTP 400, 422
- Error codes: `validation_error`, `invalid_request`, `schema_mismatch`

**Recovery:**
1. NO automatic retry (data issue requires manual fix)
2. Mark as 'pending'
3. Notify admin with full error details
4. Log payload structure for debugging (sanitized)

**Disable Threshold:** 5 consecutive data failures

### 5. Unknown Failures
**Detection:**
- Any error not matching above categories
- Unexpected HTTP status codes

**Recovery:**
1. Single retry with 1s delay
2. If fails → mark as 'pending'
3. Notify admin with full context
4. Optional: Use LLM to analyze if `useLLM=true`

**Disable Threshold:** 5 consecutive unknown failures

## Analyzer Implementation

### Deterministic Analyzer (Primary)

```typescript
interface AnalyzerInput {
  service_name: string;
  http_status?: number;
  error_code?: string;
  error_message: string;
  payload?: Record<string, any>;
  endpoint?: string;
  retry_count: number;
}

interface AnalyzerOutput {
  category: 'auth' | 'rate_limit' | 'network' | 'data' | 'unknown';
  confidence: number;  // 0-1
  signals: string[];  // What triggered this category
  advice: string;  // Human-readable recovery suggestion
}

function analyzeFailure(input: AnalyzerInput): AnalyzerOutput {
  // Auth patterns
  if (input.http_status === 401 || input.http_status === 403) {
    return {
      category: 'auth',
      confidence: 0.95,
      signals: [`HTTP ${input.http_status}`, input.error_code || ''],
      advice: 'Refresh OAuth token and retry'
    };
  }
  
  // Rate limit patterns
  if (input.http_status === 429 || 
      /rate.?limit|too.?many.?requests/i.test(input.error_message)) {
    return {
      category: 'rate_limit',
      confidence: 0.95,
      signals: [`HTTP ${input.http_status}`, 'rate limit keywords'],
      advice: 'Wait for rate limit reset and retry'
    };
  }
  
  // Network patterns
  if ([408, 500, 502, 503, 504].includes(input.http_status || 0) ||
      /ENOTFOUND|ECONNRESET|ETIMEDOUT|network/i.test(input.error_message)) {
    return {
      category: 'network',
      confidence: 0.90,
      signals: [`HTTP ${input.http_status}`, 'network error keywords'],
      advice: 'Retry with exponential backoff'
    };
  }
  
  // Data validation patterns
  if ([400, 422].includes(input.http_status || 0) ||
      /validation|invalid|schema|required/i.test(input.error_message)) {
    return {
      category: 'data',
      confidence: 0.85,
      signals: [`HTTP ${input.http_status}`, 'validation keywords'],
      advice: 'Review payload structure - manual fix required'
    };
  }
  
  return {
    category: 'unknown',
    confidence: 0.50,
    signals: ['No pattern match'],
    advice: 'Manual investigation required'
  };
}
```

### LLM Analyzer (Optional Enhancement)

Only used when `useLLM=true` and `OPENAI_API_KEY` is set:

```typescript
async function enhanceWithLLM(
  input: AnalyzerInput,
  deterministicResult: AnalyzerOutput
): Promise<string> {
  const prompt = `Analyze this integration failure and provide recovery advice:

Service: ${input.service_name}
HTTP Status: ${input.http_status}
Error Code: ${input.error_code}
Error Message: ${input.error_message}
Retry Count: ${input.retry_count}

Deterministic Analysis:
- Category: ${deterministicResult.category}
- Confidence: ${deterministicResult.confidence}
- Signals: ${deterministicResult.signals.join(', ')}

Provide:
1. Confirmation or correction of the category
2. Root cause explanation
3. Specific recovery steps
4. Prevention recommendations

Keep response under 200 words.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an integration reliability engineer. Analyze failures and provide actionable recovery advice.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 300,
      timeout: 5000  // 5s timeout
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

## Monitor Implementation

```typescript
interface RecoveryPlan {
  category: string;
  service_name: string;
  event_id: string;
  user_id?: string;
  original_payload?: Record<string, any>;
  endpoint?: string;
}

interface RecoveryResult {
  action_taken: string;
  success: boolean;
  attempts: number;
  error?: string;
  resolved_at?: string;
}

async function executeRecovery(plan: RecoveryPlan): Promise<RecoveryResult> {
  switch (plan.category) {
    case 'auth':
      return await recoverAuthFailure(plan);
    case 'rate_limit':
      return await recoverRateLimitFailure(plan);
    case 'network':
      return await recoverNetworkFailure(plan);
    case 'data':
      return await handleDataFailure(plan);
    default:
      return await handleUnknownFailure(plan);
  }
}
```

## Notification Rules

### Critical Failure (Immediate)
- First occurrence of any failure
- Auth failure after token refresh attempt
- Data validation failure
- Unknown failure category

**Message Format:**
```
🚨 Integration Failure Detected

Service: {service_name}
Category: {category}
Error: {error_message}

Recovery Plan: {action_taken}
Status: {status}

Event ID: {event_id}
Timestamp: {created_at}
```

### Recovery Attempt (Immediate)
- Token refresh initiated
- Retry sequence started
- Integration disabled

**Message Format:**
```
🔄 Recovery Attempt

Service: {service_name}
Action: {action_taken}
Attempt: {retry_count}/3

Previous Error: {error_message}
```

### Successful Resolution (Immediate)
- Failure resolved after recovery
- Integration re-enabled

**Message Format:**
```
✅ Integration Recovered

Service: {service_name}
Resolution: {action_taken}
Time to Recover: {duration}

Original Error: {failure_reason}
```

### Disable Action (Immediate)
- Integration disabled after threshold exceeded
- Manual intervention required

**Message Format:**
```
⛔ Integration Disabled

Service: {service_name}
Reason: {failure_reason}
Failure Count: {consecutive_failures}

Action Required: Manual review and re-enable
Dashboard: https://core314-admin.netlify.app/system-health
```

## Security & Guardrails

### Token Storage
- Store refresh_token in user_integrations with RLS
- Only service_role can read/write tokens
- Never log tokens or secrets
- Sanitize error payloads before logging

### Retry Storm Prevention
- Max 3 synchronous retries per event
- Track recovery_fail_count in integrations_master
- Disable integration after threshold exceeded
- Idempotency: Check event_id before processing

### Rate Limiting
- Respect Retry-After headers
- Don't sleep Edge Functions > 10s
- Use scan mode for delayed retries
- Track rate limit windows per service

### Cascading Failure Prevention
- Tag self-heal invoked attempts in payload
- Short-circuit if event already processed
- Don't create new failure events for retry failures
- Separate error tracking for self-heal function itself

## Testing Strategy

### Failure Injection (Dev Mode)

Add to integration functions:

```typescript
// In slack-alert, teams-alert, stripe-webhook, etc.
const forceFailure = req.headers.get('X-Force-Failure');
if (forceFailure && Deno.env.get('ENVIRONMENT') === 'development') {
  const failureType = forceFailure; // 'auth', 'rate_limit', 'network', 'data'
  
  const mockErrors = {
    auth: { status: 401, code: 'invalid_token', message: 'Token expired' },
    rate_limit: { status: 429, code: 'rate_limit_exceeded', message: 'Too many requests' },
    network: { status: 503, code: 'service_unavailable', message: 'Service temporarily unavailable' },
    data: { status: 400, code: 'validation_error', message: 'Invalid payload structure' }
  };
  
  const mockError = mockErrors[failureType];
  if (mockError) {
    // Log failure event
    await logEvent(supabaseAdmin, {
      service_name: 'slack', // or 'teams', 'stripe'
      event_type: 'alert.failed',
      payload: {
        error_code: mockError.code,
        error_message: mockError.message,
        http_status: mockError.status,
        forced: true
      }
    });
    
    // Call self-heal
    await fetch(`${SUPABASE_URL}/functions/v1/integration-self-heal`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-Internal-Token': INTERNAL_WEBHOOK_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: 'webhook',
        event_id: eventId,
        service_name: 'slack',
        http_status: mockError.status,
        error_code: mockError.code,
        error_message: mockError.message,
        retry_count: 0
      })
    });
    
    return new Response(JSON.stringify({ error: mockError.message }), {
      status: mockError.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

### Test Scenarios

1. **Slack Auth Failure**
   ```bash
   curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/slack-alert \
     -H "Authorization: Bearer $ANON_KEY" \
     -H "X-Force-Failure: auth" \
     -d '{"message": "test"}'
   ```

2. **Teams Rate Limit**
   ```bash
   curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/teams-alert \
     -H "Authorization: Bearer $ANON_KEY" \
     -H "X-Force-Failure: rate_limit" \
     -d '{"message": "test"}'
   ```

3. **Stripe Network Error**
   ```bash
   curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/stripe-webhook \
     -H "Authorization: Bearer $ANON_KEY" \
     -H "X-Force-Failure: network" \
     -d '{"type": "test.event"}'
   ```

## Deployment Checklist

- [ ] Create migration 035_system_integrity_events.sql
- [ ] Deploy integration-self-heal Edge Function
- [ ] Configure GitHub Actions workflow (every 15 minutes)
- [ ] Add failure injection to slack-alert, teams-alert, stripe-webhook
- [ ] Update Admin Dashboard with Self-Healing Activity tab
- [ ] Test all failure scenarios
- [ ] Verify notifications to Teams/Slack
- [ ] Document recovery thresholds
- [ ] Monitor for retry storms

## Configuration

### Environment Variables (Supabase Edge Functions)

Required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_WEBHOOK_TOKEN`
- `SLACK_WEBHOOK_URL`
- `MICROSOFT_TEAMS_WEBHOOK_URL`

Optional:
- `OPENAI_API_KEY` (for LLM-enhanced analysis)
- `ENVIRONMENT` (for failure injection)

### Recovery Thresholds (Constants)

```typescript
const RECOVERY_THRESHOLDS = {
  auth: { max_consecutive: 3, window_minutes: 60 },
  rate_limit: { max_consecutive: Infinity, window_minutes: 60 },
  network: { max_consecutive: 9, window_minutes: 60 },
  data: { max_consecutive: 5, window_minutes: 60 },
  unknown: { max_consecutive: 5, window_minutes: 60 }
};

const RETRY_CONFIG = {
  max_attempts: 3,
  base_delay_ms: 500,
  max_delay_ms: 10000,
  jitter: true
};
```

## Metrics & Monitoring

Track in system_integrity_events:
- Recovery success rate by service
- Time to recovery (resolved_at - created_at)
- Failure category distribution
- Disabled integrations count
- LLM analysis usage (if enabled)

Dashboard KPIs:
- Active failures (status='pending')
- Disabled integrations (status='disabled')
- Recovery rate (last 24h)
- Mean time to recovery (MTTR)
- Top failing services
