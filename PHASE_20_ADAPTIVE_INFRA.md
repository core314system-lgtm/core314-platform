# Phase 20: Adaptive AI Workflow Intelligence - Infrastructure & Telemetry Setup

## Overview

Phase 20 establishes the foundational infrastructure for adaptive workflow telemetry without exposing proprietary learning logic. This phase creates the data collection and monitoring infrastructure that will enable future AI-driven workflow optimization.

**Status**: Infrastructure & Telemetry Setup  
**Dependencies**: Phase 19 (Self-Healing Layer)  
**Next Phase**: Phase 21 (Adaptive Learning Engine)

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     Integration Functions                        │
│              (Slack, Teams, Stripe, Self-Healing)               │
└────────────────────────┬────────────────────────────────────────┘
                         │ Telemetry Events
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              log-adaptive-event Edge Function                    │
│  • Validates authentication (Bearer JWT + Internal Token)       │
│  • Validates event payload                                       │
│  • Inserts into adaptive_workflow_metrics                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           adaptive_workflow_metrics Table                        │
│  • workflow_id, event_type, trigger_source                      │
│  • outcome, confidence_score                                     │
│  • RLS: service_role full access, authenticated read            │
└────────────────────────┬────────────────────────────────────────┘
                         │ Supabase Realtime
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Admin Dashboard - Adaptive Workflows                │
│  • Real-time event table                                         │
│  • Summary cards (Total Events, Avg Confidence, Top Outcome)    │
│  • Filter by event_type, trigger_source, outcome                │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Table: `adaptive_workflow_metrics`

```sql
CREATE TABLE adaptive_workflow_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  outcome TEXT NOT NULL,
  confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adaptive_workflow_metrics_workflow_id 
  ON adaptive_workflow_metrics(workflow_id);
CREATE INDEX idx_adaptive_workflow_metrics_event_type 
  ON adaptive_workflow_metrics(event_type, created_at DESC);
CREATE INDEX idx_adaptive_workflow_metrics_trigger_source 
  ON adaptive_workflow_metrics(trigger_source, created_at DESC);
CREATE INDEX idx_adaptive_workflow_metrics_outcome 
  ON adaptive_workflow_metrics(outcome, created_at DESC);
CREATE INDEX idx_adaptive_workflow_metrics_created_at 
  ON adaptive_workflow_metrics(created_at DESC);
```

### Column Descriptions

- **id**: Unique identifier for each telemetry event
- **workflow_id**: Reference to the workflow instance being tracked
- **event_type**: Type of event (e.g., 'integration_triggered', 'recovery_attempted', 'workflow_completed')
- **trigger_source**: Source that triggered the workflow (e.g., 'slack', 'teams', 'stripe', 'self_healing')
- **outcome**: Result of the workflow (e.g., 'success', 'failure', 'partial', 'retry_scheduled')
- **confidence_score**: AI confidence score (0.0 to 1.0) for the workflow decision
- **metadata**: Additional context as JSON (optional, for future extensibility)
- **created_at**: Timestamp when the event was logged

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE adaptive_workflow_metrics ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Platform admins can view adaptive workflow metrics"
  ON adaptive_workflow_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Service role can insert/update/delete
CREATE POLICY "Service role can manage adaptive workflow metrics"
  ON adaptive_workflow_metrics FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
  );
```

## Edge Function: `log-adaptive-event`

### Purpose

Receives telemetry events from integration functions and self-healing systems, validates them, and logs them to the `adaptive_workflow_metrics` table.

### Authentication

Supports two authentication methods:

1. **Bearer JWT** (service_role): Standard Supabase authentication
2. **Internal Token**: Fallback for internal function-to-function calls

### Request Format

**Endpoint**: `POST /functions/v1/log-adaptive-event`

**Headers**:
```
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
X-Internal-Token: <INTERNAL_WEBHOOK_TOKEN>
Content-Type: application/json
```

**Body**:
```json
{
  "workflow_id": "uuid",
  "event_type": "integration_triggered | recovery_attempted | workflow_completed",
  "trigger_source": "slack | teams | stripe | self_healing",
  "outcome": "success | failure | partial | retry_scheduled",
  "confidence_score": 0.95,
  "metadata": {
    "additional": "context"
  }
}
```

### Response Format

**Success (200)**:
```json
{
  "success": true,
  "event_id": "uuid",
  "message": "Adaptive workflow event logged successfully"
}
```

**Error (400)**:
```json
{
  "error": "Validation error",
  "details": "confidence_score must be between 0 and 1"
}
```

**Error (401)**:
```json
{
  "error": "Unauthorized",
  "details": "Invalid authentication token"
}
```

### Sample cURL Commands

**Test with service role key**:
```bash
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/log-adaptive-event \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "integration_triggered",
    "trigger_source": "slack",
    "outcome": "success",
    "confidence_score": 0.95,
    "metadata": {
      "channel": "general",
      "message_type": "alert"
    }
  }'
```

**Test with internal token**:
```bash
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/log-adaptive-event \
  -H "X-Internal-Token: 043e3644c5b3557bafee1ac0d8dba4c0c0ac7e6ff59d3c94594f78ca08146af2" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "recovery_attempted",
    "trigger_source": "self_healing",
    "outcome": "retry_scheduled",
    "confidence_score": 0.87
  }'
```

## Admin Dashboard: Adaptive Workflows

### Page Location

`/adaptive-workflows` - New tab in Admin Dashboard navigation

### Features

1. **Summary Cards**:
   - Total Events (count)
   - Average Confidence Score (percentage)
   - Most Common Outcome (with count)
   - Recent Activity (events in last 24 hours)

2. **Event Table**:
   - Columns: Workflow ID, Event Type, Trigger Source, Outcome, Confidence, Created
   - Sortable by all columns
   - Filterable by event_type, trigger_source, outcome
   - Real-time updates via Supabase Realtime

3. **Filters**:
   - Event Type: All, Integration Triggered, Recovery Attempted, Workflow Completed
   - Trigger Source: All, Slack, Teams, Stripe, Self-Healing
   - Outcome: All, Success, Failure, Partial, Retry Scheduled
   - Time Range: Last Hour, Last 24 Hours, Last 7 Days, All Time

### Real-Time Updates

The dashboard subscribes to Supabase Realtime for the `adaptive_workflow_metrics` table:

```typescript
import { supabase } from '../../lib/supabase';

useEffect(() => {
  const channel = supabase
    .channel('adaptive-workflow-metrics-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'adaptive_workflow_metrics'
      },
      (payload) => {
        console.log('New adaptive workflow event:', payload.new);
        // Update state to display new event
        setEvents((prev) => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## Integration Examples

### From Self-Healing Function

```typescript
// In integration-self-heal/index.ts
async function logAdaptiveEvent(
  workflowId: string,
  eventType: string,
  triggerSource: string,
  outcome: string,
  confidenceScore: number
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const internalToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

  try {
    await fetch(`${supabaseUrl}/functions/v1/log-adaptive-event`, {
      method: 'POST',
      headers: {
        'X-Internal-Token': internalToken || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        event_type: eventType,
        trigger_source: triggerSource,
        outcome: outcome,
        confidence_score: confidenceScore
      })
    });
  } catch (err) {
    console.error('Failed to log adaptive event:', err);
  }
}

// Usage in self-healing recovery
const recoveryId = crypto.randomUUID();
await logAdaptiveEvent(
  recoveryId,
  'recovery_attempted',
  'self_healing',
  'retry_scheduled',
  0.87
);
```

### From Integration Function

```typescript
// In slack-alert/index.ts
async function logWorkflowEvent(
  workflowId: string,
  outcome: string,
  confidence: number
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const internalToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');

  await fetch(`${supabaseUrl}/functions/v1/log-adaptive-event`, {
    method: 'POST',
    headers: {
      'X-Internal-Token': internalToken || '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      event_type: 'integration_triggered',
      trigger_source: 'slack',
      outcome: outcome,
      confidence_score: confidence
    })
  });
}

// Usage after successful alert
const workflowId = crypto.randomUUID();
await logWorkflowEvent(workflowId, 'success', 0.95);
```

## Event Types

### `integration_triggered`
Logged when an integration function is called and begins processing.

**Example**:
```json
{
  "workflow_id": "uuid",
  "event_type": "integration_triggered",
  "trigger_source": "slack",
  "outcome": "success",
  "confidence_score": 0.95
}
```

### `recovery_attempted`
Logged when the self-healing system attempts to recover from a failure.

**Example**:
```json
{
  "workflow_id": "uuid",
  "event_type": "recovery_attempted",
  "trigger_source": "self_healing",
  "outcome": "retry_scheduled",
  "confidence_score": 0.87
}
```

### `workflow_completed`
Logged when a multi-step workflow completes (success or failure).

**Example**:
```json
{
  "workflow_id": "uuid",
  "event_type": "workflow_completed",
  "trigger_source": "teams",
  "outcome": "partial",
  "confidence_score": 0.72
}
```

## Deployment Checklist

### Database Setup

- [ ] Run migration `036_adaptive_workflow_metrics.sql` in Supabase SQL Editor
- [ ] Verify table created: `adaptive_workflow_metrics`
- [ ] Verify RLS policies applied
- [ ] Verify indexes created
- [ ] Enable Realtime for `adaptive_workflow_metrics` table in Supabase Dashboard

### Edge Function Deployment

- [ ] Deploy `log-adaptive-event` function to Supabase
- [ ] Verify function is accessible at endpoint
- [ ] Test with sample event using cURL
- [ ] Verify event logged in database

### Admin Dashboard

- [ ] Deploy updated admin platform with Adaptive Workflows page
- [ ] Verify page loads without errors
- [ ] Verify real-time updates work
- [ ] Verify filters and sorting work
- [ ] Verify summary cards display correct data

### Environment Variables

Ensure these are set in Supabase Edge Functions:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations
- `INTERNAL_WEBHOOK_TOKEN`: Token for internal function-to-function calls

## Testing

### Manual Testing

1. **Insert Test Event via SQL**:
```sql
INSERT INTO adaptive_workflow_metrics (
  workflow_id,
  event_type,
  trigger_source,
  outcome,
  confidence_score
) VALUES (
  gen_random_uuid(),
  'integration_triggered',
  'slack',
  'success',
  0.95
);
```

2. **Test Edge Function**:
```bash
curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/log-adaptive-event \
  -H "X-Internal-Token: 043e3644c5b3557bafee1ac0d8dba4c0c0ac7e6ff59d3c94594f78ca08146af2" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "integration_triggered",
    "trigger_source": "slack",
    "outcome": "success",
    "confidence_score": 0.95
  }'
```

3. **Verify in Dashboard**:
   - Navigate to https://core314-admin.netlify.app/adaptive-workflows
   - Verify event appears in table
   - Verify summary cards update
   - Verify real-time updates work (insert another event and watch it appear)

### Automated Testing

Future phases will include:
- Unit tests for Edge Function validation logic
- Integration tests for end-to-end event flow
- Load tests for high-volume telemetry

## Security Considerations

1. **Authentication**: All requests must be authenticated via Bearer JWT or Internal Token
2. **RLS Policies**: Only platform admins can read metrics, only service_role can write
3. **Token Storage**: Internal webhook token stored as environment variable, never logged
4. **Data Privacy**: No PII stored in telemetry events
5. **Rate Limiting**: Consider implementing rate limiting in future phases

## Future Enhancements (Phase 21+)

1. **Adaptive Learning Engine**: Analyze patterns in telemetry data to optimize workflows
2. **Predictive Analytics**: Predict failure likelihood based on historical patterns
3. **Automated Optimization**: Automatically adjust workflow parameters based on outcomes
4. **Anomaly Detection**: Detect unusual patterns in workflow behavior
5. **Performance Metrics**: Track and optimize workflow execution time and resource usage

## Metrics & KPIs

Track these metrics to measure Phase 20 success:

- **Event Volume**: Total events logged per day/week/month
- **Event Types Distribution**: Breakdown by event_type
- **Trigger Source Distribution**: Breakdown by trigger_source
- **Outcome Distribution**: Success rate, failure rate, retry rate
- **Average Confidence Score**: Overall confidence in workflow decisions
- **Real-Time Latency**: Time from event occurrence to dashboard display

## Troubleshooting

### Events Not Appearing in Dashboard

1. Check Supabase Realtime is enabled for `adaptive_workflow_metrics` table
2. Verify RLS policies allow authenticated users to read
3. Check browser console for WebSocket connection errors
4. Verify admin user has `is_platform_admin = true` in profiles table

### Edge Function Returns 401

1. Verify `INTERNAL_WEBHOOK_TOKEN` environment variable is set
2. Check token matches in both calling function and log-adaptive-event
3. Verify Bearer token is valid service_role key

### Confidence Score Validation Error

1. Ensure confidence_score is between 0.0 and 1.0
2. Check numeric precision (max 4 decimal places)
3. Verify value is not null

## References

- Phase 19: Self-Healing Layer (PHASE_19_SELF_HEALING.md)
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

---

**Phase 20 Status**: Infrastructure & Telemetry Setup Complete  
**Next Phase**: Phase 21 - Adaptive Learning Engine  
**Documentation Version**: 1.0  
**Last Updated**: November 5, 2025
