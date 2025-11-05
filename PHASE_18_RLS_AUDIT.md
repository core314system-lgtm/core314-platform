# Phase 18: RLS Audit and Verification Script Implementation

## Overview

The RLS Audit and Verification System automatically checks all Supabase tables for correct Row Level Security (RLS) policy configurations, logs results, and sends automated alerts if any discrepancies are detected. This ensures database security compliance and helps identify tables that may be missing RLS protection.

## Architecture

### Components

1. **Database Table** (`rls_audit_log`)
   - Logs all RLS audit results with detailed information
   - Fields: id, table_name, status, details (jsonb), last_checked
   - RLS enabled: Only platform admins can view logs
   - Stores one row per table per audit + one "_SUMMARY_" row per run

2. **SQL Function** (`rls_audit_check()`)
   - Iterates through all tables in public schema
   - Verifies each table has RLS enabled and at least one policy
   - Logs results into rls_audit_log table
   - Returns JSON summary with pass/fail counts and issues
   - SECURITY DEFINER with explicit search_path for consistent execution

3. **Edge Function** (`verify-rls`)
   - Triggers the SQL audit function via RPC
   - Supports dual authentication:
     - Admin JWT for manual runs
     - Internal token for scheduled runs
   - Sends Teams/Slack alerts when failures are detected
   - Returns JSON summary with audit results

4. **Weekly Cron Job**
   - Scheduled via Supabase Functions Scheduler
   - Runs every Monday at 3:00 AM UTC
   - Automatically triggers verify-rls with internal token
   - Sends alerts if any tables fail RLS checks

## Setup

### 1. Apply Database Migration

Run the migration to create the rls_audit_log table and rls_audit_check() function:

```bash
# In Supabase SQL Editor
# File: core314-app/supabase/migrations/033_rls_audit_log.sql
```

Or apply programmatically:

```bash
cd core314-app
supabase db push
```

### 2. Deploy Edge Function

```bash
cd core314-app
supabase functions deploy verify-rls --project-ref ygvkegcstaowikessigx
```

### 3. Configure Environment Variables

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
# Required for all functions
SUPABASE_URL=https://ygvkegcstaowikessigx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>

# For scheduled runs (same token as Phase 17)
INTERNAL_WEBHOOK_TOKEN=<your-secure-random-token>

# For alerts (from Phase 17)
MICROSOFT_TEAMS_WEBHOOK_URL=<your-teams-webhook-url>
SLACK_WEBHOOK_URL=<your-slack-webhook-url>
```

### 4. Configure Weekly Cron Job

**Option A: Using Supabase Functions Scheduler (Recommended)**

1. Go to Supabase Dashboard → Edge Functions → Schedules
2. Create new schedule:
   - **Name**: `weekly-rls-audit`
   - **Function**: `verify-rls`
   - **Cron Expression**: `0 3 * * 1` (Every Monday at 3:00 AM UTC)
   - **Headers**: `X-Internal-Token: <your-internal-webhook-token>`
   - **Query Parameters**: `alerts=true`

**Option B: Using pg_cron (Alternative)**

If Supabase Functions Scheduler doesn't support custom headers, use pg_cron:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule weekly RLS audit
SELECT cron.schedule(
  'weekly-rls-audit',
  '0 3 * * 1',  -- Every Monday at 3:00 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://ygvkegcstaowikessigx.supabase.co/functions/v1/verify-rls?alerts=true',
    headers := jsonb_build_object(
      'X-Internal-Token', '<your-internal-webhook-token>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

## Usage

### Manual RLS Audit (Admin Only)

**Endpoint:** `https://ygvkegcstaowikessigx.supabase.co/functions/v1/verify-rls`

**Authentication:** Supabase JWT (platform admin only)

**Query Parameters:**
- `ignore_tables` (optional) - Comma-separated list of tables to skip
- `alerts` (optional) - Set to `true` to send Teams/Slack alerts if failures detected

**Example Request:**

```bash
curl -X POST "https://ygvkegcstaowikessigx.supabase.co/functions/v1/verify-rls?alerts=true" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

**Example Response:**

```json
{
  "success": true,
  "audit_run_id": "550e8400-e29b-41d4-a716-446655440000",
  "summary": {
    "pass_count": 28,
    "fail_count": 2,
    "total_tables": 30,
    "status": "FAIL"
  },
  "issues": [
    {
      "table": "temp_staging_data",
      "rls_enabled": false,
      "policy_count": 0,
      "reason": "RLS not enabled"
    },
    {
      "table": "lookup_cache",
      "rls_enabled": true,
      "policy_count": 0,
      "reason": "No policies defined"
    }
  ],
  "alerts_sent": true,
  "triggered_by": "admin-user-id",
  "timestamp": "2025-11-05T03:00:00.000Z"
}
```

### Scheduled RLS Audit (Automatic)

The weekly cron job automatically runs the audit every Monday at 3:00 AM UTC using the internal token for authentication. If any failures are detected, alerts are automatically sent to configured Teams/Slack channels.

### Viewing Audit History

**Query all audit runs:**

```sql
SELECT * FROM rls_audit_log 
WHERE table_name = '_SUMMARY_' 
ORDER BY last_checked DESC 
LIMIT 10;
```

**Query specific table audit history:**

```sql
SELECT * FROM rls_audit_log 
WHERE table_name = 'profiles' 
ORDER BY last_checked DESC 
LIMIT 10;
```

**Query failed audits:**

```sql
SELECT * FROM rls_audit_log 
WHERE status = 'fail' 
ORDER BY last_checked DESC;
```

**Query latest audit run details:**

```sql
SELECT 
  table_name,
  status,
  details->>'rls_enabled' as rls_enabled,
  details->>'policy_count' as policy_count,
  details->>'reason' as reason,
  last_checked
FROM rls_audit_log
WHERE details->>'audit_run_id' = (
  SELECT details->>'audit_run_id' 
  FROM rls_audit_log 
  WHERE table_name = '_SUMMARY_' 
  ORDER BY last_checked DESC 
  LIMIT 1
)
ORDER BY status DESC, table_name;
```

## Ignoring Tables

Some tables may be intentionally without RLS (e.g., lookup tables, staging tables, public reference data). To exclude these from audits:

**Method 1: Query Parameter (Manual Runs)**

```bash
curl -X POST "https://ygvkegcstaowikessigx.supabase.co/functions/v1/verify-rls?ignore_tables=temp_staging,lookup_cache" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

**Method 2: Update Cron Job (Scheduled Runs)**

Update the cron job query parameters to include ignore_tables:

```
?alerts=true&ignore_tables=temp_staging,lookup_cache
```

**Method 3: Create Ignore List Table (Advanced)**

For persistent ignore lists, create a configuration table:

```sql
CREATE TABLE IF NOT EXISTS public.rls_audit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ignore_tables TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.rls_audit_config (ignore_tables)
VALUES (ARRAY['temp_staging', 'lookup_cache']);
```

Then modify the edge function to read from this table.

## Alert Format

When failures are detected, alerts are sent to Teams/Slack with the following format:

```
🚨 RLS Audit Failed: 2 table(s) with issues

RLS Audit completed at 2025-11-05T03:00:00.000Z

**Summary:**
- Total tables audited: 30
- Passed: 28
- Failed: 2

**Issues Found:**
- **temp_staging_data**: RLS not enabled
  - RLS Enabled: No
  - Policy Count: 0
- **lookup_cache**: No policies defined
  - RLS Enabled: Yes
  - Policy Count: 0

View detailed logs in Supabase Dashboard:
https://supabase.com/dashboard/project/ygvkegcstaowikessigx/editor

Query: SELECT * FROM rls_audit_log WHERE table_name = '_SUMMARY_' ORDER BY last_checked DESC LIMIT 1;
```

## Audit Criteria

A table **PASSES** the audit if:
- RLS is enabled (`ALTER TABLE table_name ENABLE ROW LEVEL SECURITY`)
- At least one RLS policy exists

A table **FAILS** the audit if:
- RLS is not enabled, OR
- RLS is enabled but no policies are defined

## Understanding Audit Results

### Status: PASS

The table has proper RLS configuration:
- RLS is enabled
- At least one policy exists (SELECT, INSERT, UPDATE, or DELETE)
- Users cannot bypass RLS unless they have service role access

### Status: FAIL - RLS not enabled

**Risk**: All authenticated users can read/write all rows in the table.

**Fix**:
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Then add appropriate policies
CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);
```

### Status: FAIL - No policies defined

**Risk**: RLS is enabled but no policies exist, so NO users can access the table (except service role).

**Fix**:
```sql
-- Add appropriate policies based on your access requirements
CREATE POLICY "policy_name"
  ON table_name FOR SELECT
  USING (/* your condition */);
```

## Troubleshooting

### Issue: Audit function returns empty results

**Cause**: Function may not have permission to query pg_catalog tables.

**Fix**: Ensure the function is created with `SECURITY DEFINER`:

```sql
ALTER FUNCTION public.rls_audit_check SECURITY DEFINER;
```

### Issue: Edge function returns 401 Unauthorized

**Cause**: Missing or invalid authentication.

**Fix**:
- For manual runs: Ensure you're passing a valid Supabase JWT for a platform admin user
- For scheduled runs: Verify `INTERNAL_WEBHOOK_TOKEN` is set correctly and matches the cron job header

### Issue: Alerts not sending

**Cause**: Webhook URLs not configured or invalid.

**Fix**:
1. Verify `MICROSOFT_TEAMS_WEBHOOK_URL` and `SLACK_WEBHOOK_URL` are set in Supabase secrets
2. Test webhook URLs directly:

```bash
# Test Teams webhook
curl -X POST "YOUR_TEAMS_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message from Core314"}'

# Test Slack webhook
curl -X POST "YOUR_SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message from Core314"}'
```

### Issue: Cron job not running

**Cause**: Schedule not configured or function name incorrect.

**Fix**:
1. Verify schedule exists in Supabase Dashboard → Edge Functions → Schedules
2. Check cron expression is valid: `0 3 * * 1` (Monday 3:00 AM UTC)
3. Verify function name is exactly `verify-rls`
4. Check function logs for errors

### Issue: False positives for intentional non-RLS tables

**Cause**: Some tables (lookup tables, staging tables) may intentionally not have RLS.

**Fix**: Add these tables to the ignore list using the `ignore_tables` parameter.

### Issue: Audit takes too long

**Cause**: Large number of tables or complex policies.

**Fix**:
- The audit function is optimized with indexes
- Consider running audits during off-peak hours
- Use ignore_tables to skip non-critical tables

## Security Considerations

1. **Admin-Only Access**: Only platform admins can manually trigger audits
2. **Service Role Protection**: The SQL function uses SECURITY DEFINER but is only callable via edge function
3. **Internal Token**: Scheduled runs use a secure internal token separate from user authentication
4. **RLS on Audit Log**: The rls_audit_log table itself has RLS enabled - only admins can view
5. **No Public Access**: The verify-rls edge function requires authentication (JWT or internal token)
6. **Audit Trail**: All audit runs are logged with timestamps and details for compliance

## Best Practices

1. **Regular Audits**: Keep the weekly schedule enabled to catch RLS issues early
2. **Review Failures Promptly**: Investigate and fix any failed audits within 24 hours
3. **Document Exceptions**: Maintain a list of intentionally non-RLS tables with justification
4. **Test After Schema Changes**: Run manual audits after adding new tables or modifying RLS policies
5. **Monitor Alerts**: Ensure Teams/Slack channels are monitored by security/ops team
6. **Audit the Auditor**: Periodically review rls_audit_log to ensure audits are running correctly
7. **Backup Audit Logs**: Consider exporting audit history for compliance reporting

## Integration with Phase 17

Phase 18 builds on the integration layer from Phase 17:

- **Reuses Teams/Slack Webhooks**: Uses the same webhook URLs configured in Phase 17
- **Reuses Integration Utilities**: Uses postToTeams() and postToSlack() from integration-utils.ts
- **Consistent Authentication**: Uses the same INTERNAL_WEBHOOK_TOKEN for scheduled runs
- **Unified Monitoring**: Alerts appear in the same Teams/Slack channels as integration events

## Compliance and Reporting

### Weekly Audit Report

Generate a weekly summary report:

```sql
SELECT 
  DATE_TRUNC('week', last_checked) as week,
  COUNT(*) FILTER (WHERE status = 'pass') as passed,
  COUNT(*) FILTER (WHERE status = 'fail') as failed,
  COUNT(*) as total
FROM rls_audit_log
WHERE table_name = '_SUMMARY_'
  AND last_checked >= NOW() - INTERVAL '12 weeks'
GROUP BY week
ORDER BY week DESC;
```

### Table-Specific Trends

Track RLS compliance trends for specific tables:

```sql
SELECT 
  table_name,
  status,
  details->>'policy_count' as policy_count,
  last_checked
FROM rls_audit_log
WHERE table_name = 'profiles'
ORDER BY last_checked DESC
LIMIT 20;
```

### Compliance Dashboard Query

Get current RLS compliance status:

```sql
WITH latest_run AS (
  SELECT details->>'audit_run_id' as run_id
  FROM rls_audit_log
  WHERE table_name = '_SUMMARY_'
  ORDER BY last_checked DESC
  LIMIT 1
)
SELECT 
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE status = 'pass') as compliant,
  COUNT(*) FILTER (WHERE status = 'fail') as non_compliant,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'pass') / COUNT(*), 2) as compliance_percentage
FROM rls_audit_log
WHERE details->>'audit_run_id' = (SELECT run_id FROM latest_run)
  AND table_name != '_SUMMARY_';
```

## API Reference

### SQL Function: rls_audit_check()

**Signature:**
```sql
rls_audit_check(ignore_tables TEXT[] DEFAULT ARRAY[]::TEXT[]) RETURNS JSONB
```

**Parameters:**
- `ignore_tables`: Array of table names to exclude from audit

**Returns:**
```json
{
  "audit_run_id": "uuid",
  "pass_count": 28,
  "fail_count": 2,
  "total_tables": 30,
  "issues": [...],
  "timestamp": "2025-11-05T03:00:00.000Z"
}
```

**Example:**
```sql
SELECT rls_audit_check(ARRAY['temp_staging', 'lookup_cache']);
```

### Edge Function: verify-rls

**Endpoint:** `POST /functions/v1/verify-rls`

**Authentication:**
- Admin JWT: `Authorization: Bearer <jwt>`
- Internal Token: `X-Internal-Token: <token>`

**Query Parameters:**
- `ignore_tables` (string): Comma-separated list of tables to skip
- `alerts` (boolean): Set to `true` to send alerts on failures

**Response:**
```json
{
  "success": true,
  "audit_run_id": "uuid",
  "summary": {
    "pass_count": 28,
    "fail_count": 2,
    "total_tables": 30,
    "status": "PASS|FAIL"
  },
  "issues": [...],
  "alerts_sent": true,
  "triggered_by": "user-id|scheduler",
  "timestamp": "2025-11-05T03:00:00.000Z"
}
```

## Future Enhancements

Potential improvements for future phases:

1. **Policy Quality Checks**: Verify policies are not overly permissive (e.g., `USING (true)`)
2. **Performance Monitoring**: Track audit execution time and optimize slow queries
3. **Custom Rules**: Allow defining custom RLS requirements per table
4. **Automated Remediation**: Suggest or auto-apply RLS policies for failed tables
5. **Integration with CI/CD**: Run audits on schema changes before deployment
6. **Compliance Reporting**: Generate PDF reports for security audits
7. **Slack/Teams Commands**: Interactive commands to trigger audits or view results
8. **Dashboard UI**: Admin interface to view audit history and trends

## Support

For issues or questions:
- Review function logs in Supabase Dashboard → Edge Functions → verify-rls
- Check rls_audit_log table for detailed audit history
- Verify environment variables are set correctly
- Consult Phase 17 documentation for Teams/Slack webhook setup

## Next Steps

After successful deployment and testing of Phase 18, the Core314 platform will have:
- ✅ Comprehensive RLS audit system
- ✅ Automated weekly security checks
- ✅ Real-time alerts for RLS issues
- ✅ Complete audit trail for compliance

This completes the security infrastructure for the Core314 platform. Future phases can build on this foundation for enhanced security monitoring and compliance reporting.
