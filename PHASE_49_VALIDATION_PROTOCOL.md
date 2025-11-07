# Phase 49: Structured E2E Validation Campaign (SEVC) - Validation Protocol

## Executive Summary

Phase 49 extends the End-to-End Orchestration Layer (Phase 48) with automated multi-cycle benchmarking, anomaly injection, and performance analytics capabilities. This protocol defines the comprehensive testing procedures for validating the Structured E2E Validation Campaign system.

**Implementation Date**: November 7, 2025  
**Version**: 1.0  
**Status**: Ready for Testing

---

## 1. Components Implemented

### 1.1 Database Enhancements

**Tables Modified:**
- `fusion_e2e_sessions` - Added 4 new columns:
  - `test_mode` (TEXT): Campaign mode - functional, performance, or resilience
  - `simulation_cycles` (INTEGER): Number of validation cycles executed
  - `errors_detected` (INTEGER): Count of failed phase iterations
  - `avg_stability` (NUMERIC): Average stability score across benchmarks

**New Tables Created:**
- `fusion_e2e_benchmarks` - Individual iteration benchmarks
  - Tracks per-phase, per-iteration metrics (confidence, latency, stability)
  - 4 indexes for performance: session_id, session_id+iteration, created_at, phase_name
  - RLS policies: platform_admin only, service_role full access

- `fusion_e2e_anomalies` - Injected anomalies for resilience testing
  - Records test anomalies during resilience campaigns
  - 2 indexes: session_id, created_at
  - RLS policies: platform_admin only, service_role full access

### 1.2 SQL Function

**Function**: `run_structured_e2e_campaign(p_test_mode TEXT, p_cycles INTEGER)`

**Behavior**:
- Creates campaign session with specified test mode and cycle count
- Executes `run_e2e_validation_cycle()` p_cycles times in sequence
- For each iteration:
  - Captures 6 phase results (simulation, governance, policy, neural, trust, explainability)
  - Calculates stability score: `1 - |confidence - avg_confidence|` clamped to [0,1]
  - Sets error_flag based on phase status
  - Inserts 6 benchmark records
- For resilience mode: Injects anomalies every 3rd iteration
- Updates campaign session with aggregated metrics
- Returns: session_id, total_iterations, avg_confidence, avg_latency, avg_stability, errors_detected

**Error Handling**:
- Per-iteration EXCEPTION blocks prevent single-cycle failures from aborting campaign
- Anomaly injection wrapped in EXCEPTION to avoid failures if audit log unavailable
- Continues execution even if individual phases fail

### 1.3 Edge Function

**Endpoint**: `https://ygvkegcstaowikessigx.supabase.co/functions/v1/e2e-campaign-engine`

**POST Handler**:
- Accepts JSON: `{ "test_mode": "functional|performance|resilience", "cycles": 1-100 }`
- Validates inputs (test_mode enum, cycles range)
- Calls `run_structured_e2e_campaign()` via RPC
- Returns campaign result with metrics

**GET Handler**:
- Without session_id: Returns recent campaign sessions summary with aggregate metrics
- With session_id: Returns specific session with all benchmarks and anomalies

**Authorization**: Platform admin only (verified via is_platform_admin or role='platform_admin')

### 1.4 Admin Dashboard

**Route**: `/e2e-campaign`

**Features**:
- **5 KPI Cards**: Total Runs, Avg Confidence, Avg Latency, Avg Stability, Errors Detected
- **4 Charts**:
  1. Confidence Trend Over Iterations (line chart)
  2. Latency vs Confidence Scatter (scatter plot)
  3. Stability Distribution (bar chart - 5 ranges)
  4. Cycle Completion Timeline (bar chart)
- **Campaign Controls**: 3 buttons for running campaigns
  - Functional (10 cycles)
  - Performance (50 cycles)
  - Resilience (15 cycles)
- **Benchmarks Table**: Shows iteration, phase_name, confidence, latency_ms, stability, error_flag, created_at
- **Filters**: Phase, Test Mode, Session
- **Export**: CSV export of filtered benchmarks
- **Refresh**: Manual data refresh

---

## 2. Pre-Deployment Testing Checklist

### 2.1 Database Migration Validation

- [ ] **Migration File**: Verify `059_structured_e2e_campaign.sql` exists
- [ ] **Syntax Check**: SQL parses without errors
- [ ] **Table Creation**: fusion_e2e_benchmarks and fusion_e2e_anomalies created
- [ ] **Column Addition**: fusion_e2e_sessions has 4 new columns
- [ ] **Indexes**: All 6 indexes created (4 benchmarks, 2 anomalies)
- [ ] **RLS Policies**: 8 policies created (4 benchmarks, 4 anomalies)
- [ ] **Function Creation**: run_structured_e2e_campaign() exists
- [ ] **Grants**: EXECUTE granted to service_role
- [ ] **Comments**: All table and column comments added

**Verification Query**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('fusion_e2e_benchmarks', 'fusion_e2e_anomalies');

-- Check columns added
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'fusion_e2e_sessions' 
AND column_name IN ('test_mode', 'simulation_cycles', 'errors_detected', 'avg_stability');

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'run_structured_e2e_campaign';
```

### 2.2 Edge Function Deployment

- [ ] **Function Deployed**: e2e-campaign-engine deployed to Supabase
- [ ] **Endpoint Reachable**: HTTPS endpoint responds
- [ ] **CORS Configured**: OPTIONS requests return proper headers
- [ ] **Environment Variables**: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY set
- [ ] **Authorization**: Rejects requests without Bearer token
- [ ] **Platform Admin Check**: Rejects non-admin users

**Verification Command**:
```bash
curl -X OPTIONS https://ygvkegcstaowikessigx.supabase.co/functions/v1/e2e-campaign-engine
# Should return 200 with CORS headers

curl -X POST https://ygvkegcstaowikessigx.supabase.co/functions/v1/e2e-campaign-engine
# Should return 401 Missing authorization header
```

### 2.3 Dashboard Component

- [ ] **Component File**: E2ECampaign.tsx exists in pages/admin/
- [ ] **Import Added**: App.tsx imports E2ECampaign
- [ ] **Route Added**: /e2e-campaign route configured
- [ ] **TypeScript Compiles**: No type errors
- [ ] **Lint Clean**: No ESLint errors in E2ECampaign.tsx
- [ ] **Dependencies**: Recharts, Lucide icons available

**Verification Command**:
```bash
cd core314-admin
npx eslint src/pages/admin/E2ECampaign.tsx
npm run build
```

---

## 3. Post-Deployment Testing Scenarios

### 3.1 Functional Mode Campaign (10 Cycles)

**Objective**: Verify basic multi-cycle orchestration with stable conditions

**Steps**:
1. Navigate to `/e2e-campaign` in admin dashboard
2. Click "Functional (10 cycles)" button
3. Wait for campaign completion (30-60 seconds)
4. Verify alert shows:
   - Session ID (UUID)
   - Total Iterations: 60 (10 cycles × 6 phases)
   - Avg Confidence: ~0.86
   - Avg Latency: 200-500ms
   - Avg Stability: >0.95
   - Errors: 0

**Expected Results**:
- ✅ Campaign completes without errors
- ✅ 60 records inserted into fusion_e2e_benchmarks
- ✅ 1 session record in fusion_e2e_sessions with test_mode='functional'
- ✅ All error_flag values are FALSE
- ✅ Stability scores are high (>0.9)
- ✅ Dashboard KPI cards update with new metrics
- ✅ Charts populate with 60 data points

**Verification Queries**:
```sql
-- Check benchmark count
SELECT COUNT(*) FROM fusion_e2e_benchmarks 
WHERE session_id = '<session_id>';
-- Expected: 60

-- Check session summary
SELECT test_mode, simulation_cycles, steps_completed, 
       avg_confidence, avg_latency_ms, avg_stability, errors_detected
FROM fusion_e2e_sessions 
WHERE id = '<session_id>';
-- Expected: functional, 10, 60, ~0.86, 200-500, >0.95, 0

-- Check error distribution
SELECT error_flag, COUNT(*) 
FROM fusion_e2e_benchmarks 
WHERE session_id = '<session_id>' 
GROUP BY error_flag;
-- Expected: FALSE: 60
```

### 3.2 Performance Mode Campaign (50 Cycles)

**Objective**: Verify high-volume benchmarking and latency tracking

**Steps**:
1. Navigate to `/e2e-campaign` in admin dashboard
2. Click "Performance (50 cycles)" button
3. Wait for campaign completion (2-5 minutes)
4. Verify alert shows:
   - Total Iterations: 300 (50 cycles × 6 phases)
   - Avg Latency: <600ms (performance target)
   - Errors: <5 (acceptable failure rate)

**Expected Results**:
- ✅ Campaign completes within 5 minutes
- ✅ 300 records inserted into fusion_e2e_benchmarks
- ✅ 1 session record with test_mode='performance'
- ✅ Average latency remains under 600ms
- ✅ Confidence Trend chart shows stable pattern
- ✅ Latency vs Confidence scatter shows clustering
- ✅ No Edge Function timeouts

**Verification Queries**:
```sql
-- Check latency distribution
SELECT 
  MIN(latency_ms) as min_latency,
  AVG(latency_ms) as avg_latency,
  MAX(latency_ms) as max_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
FROM fusion_e2e_benchmarks 
WHERE session_id = '<session_id>';
-- Expected: avg < 600ms, p95 < 800ms

-- Check phase-wise latency
SELECT phase_name, AVG(latency_ms) as avg_latency
FROM fusion_e2e_benchmarks 
WHERE session_id = '<session_id>'
GROUP BY phase_name
ORDER BY avg_latency DESC;
-- Identify slowest phases
```

### 3.3 Resilience Mode Campaign (15 Cycles)

**Objective**: Verify anomaly injection and error handling

**Steps**:
1. Navigate to `/e2e-campaign` in admin dashboard
2. Click "Resilience (15 cycles)" button
3. Wait for campaign completion (45-90 seconds)
4. Verify alert shows:
   - Total Iterations: 90 (15 cycles × 6 phases)
   - Errors: May be >0 (anomalies injected)

**Expected Results**:
- ✅ Campaign completes despite anomalies
- ✅ 90 records inserted into fusion_e2e_benchmarks
- ✅ 5 anomaly records in fusion_e2e_anomalies (iterations 3, 6, 9, 12, 15)
- ✅ 1 session record with test_mode='resilience'
- ✅ Some error_flag values may be TRUE
- ✅ Campaign doesn't abort on errors
- ✅ Anomalies visible in fusion_audit_log (if compatible)

**Verification Queries**:
```sql
-- Check anomaly injection
SELECT iteration, anomaly_type, impact, confidence_level
FROM fusion_e2e_anomalies 
WHERE session_id = '<session_id>'
ORDER BY iteration;
-- Expected: 5 records at iterations 3, 6, 9, 12, 15

-- Check error distribution
SELECT error_flag, COUNT(*) 
FROM fusion_e2e_benchmarks 
WHERE session_id = '<session_id>' 
GROUP BY error_flag;
-- Expected: Some TRUE values

-- Check audit log (optional)
SELECT COUNT(*) FROM fusion_audit_log 
WHERE triggered_by = 'SEVC' 
AND created_at > NOW() - INTERVAL '10 minutes';
-- Expected: 5 records (if compatible)
```

### 3.4 Dashboard Visualization Testing

**Objective**: Verify all charts and filters work correctly

**Steps**:
1. Run at least 3 campaigns (1 of each mode)
2. Navigate to `/e2e-campaign`
3. Verify KPI cards show aggregate metrics
4. Test each chart:
   - Confidence Trend: Shows line progression
   - Latency vs Confidence: Shows scatter points
   - Stability Distribution: Shows 5 bars
   - Cycle Completion: Shows session bars
5. Test filters:
   - Filter by Phase: Select "simulation" - table updates
   - Filter by Test Mode: Select "functional" - table updates
   - Filter by Session: Select specific session - table updates
6. Test Export CSV: Downloads file with correct data
7. Test Refresh: Reloads data from database

**Expected Results**:
- ✅ All 5 KPI cards display correct aggregate values
- ✅ All 4 charts render without errors
- ✅ Charts update when new campaigns run
- ✅ Filters correctly reduce table rows
- ✅ CSV export contains all filtered rows
- ✅ Refresh button reloads latest data

---

## 4. Performance Metrics & Targets

### 4.1 Latency Targets

| Test Mode | Cycles | Expected Total Time | Avg Latency per Phase |
|-----------|--------|---------------------|----------------------|
| Functional | 10 | 30-60 seconds | 200-500ms |
| Performance | 50 | 2-5 minutes | <600ms |
| Resilience | 15 | 45-90 seconds | 200-600ms |

### 4.2 Confidence Targets

| Phase | Expected Confidence | Acceptable Range |
|-------|-------------------|------------------|
| Simulation | 0.90 | 0.85-0.95 |
| Governance | 0.85 | 0.80-0.90 |
| Policy | 0.82 | 0.77-0.87 |
| Neural | 0.88 | 0.83-0.93 |
| Trust | 0.84 | 0.79-0.89 |
| Explainability | 0.87 | 0.82-0.92 |

**Overall Average**: 0.86 (0.81-0.91 acceptable)

### 4.3 Stability Targets

| Test Mode | Expected Avg Stability | Minimum Acceptable |
|-----------|----------------------|-------------------|
| Functional | >0.95 | >0.90 |
| Performance | >0.92 | >0.85 |
| Resilience | >0.88 | >0.80 |

### 4.4 Error Rate Targets

| Test Mode | Expected Errors | Maximum Acceptable |
|-----------|----------------|-------------------|
| Functional | 0 | 2 (3.3%) |
| Performance | 0-5 | 15 (5%) |
| Resilience | 0-10 | 20 (22%) |

---

## 5. Known Limitations

### 5.1 Cycle Count Limits

- **Maximum Cycles**: 100 (enforced by Edge Function)
- **Reason**: Prevent excessive runtime and database load
- **Workaround**: Run multiple campaigns sequentially

### 5.2 Concurrent Campaign Execution

- **Issue**: Multiple simultaneous campaigns may cause race conditions
- **Mitigation**: Each campaign creates separate session_id
- **Recommendation**: Run campaigns sequentially for accurate benchmarking

### 5.3 Anomaly Injection Compatibility

- **Issue**: fusion_audit_log schema may not match expected columns
- **Mitigation**: Wrapped in EXCEPTION block to prevent campaign failure
- **Impact**: Anomalies recorded in fusion_e2e_anomalies regardless

### 5.4 Edge Function Timeout

- **Issue**: Very large cycle counts (>100) may timeout
- **Current Limit**: 100 cycles enforced
- **Future Enhancement**: Async execution with polling

### 5.5 Historical Data Retention

- **Issue**: No automatic cleanup of old benchmark data
- **Impact**: Table growth over time
- **Recommendation**: Implement periodic archival (future phase)

---

## 6. Integration Points

Phase 49 integrates with the following existing systems:

### 6.1 Phase 48: E2E Orchestration Layer
- **Dependency**: Calls `run_e2e_validation_cycle()` for each iteration
- **Tables Used**: fusion_e2e_sessions, fusion_e2e_results
- **Integration**: Extends sessions table with campaign-specific columns

### 6.2 Phase 47: Unified Simulation Environment
- **Invoked By**: run_full_system_simulation(5) in each cycle
- **Metrics**: Simulation phase confidence and latency

### 6.3 Phase 44: Governance Framework
- **Invoked By**: fusion_governance_engine() in each cycle
- **Metrics**: Governance phase confidence and latency

### 6.4 Phase 42: Adaptive Policy Engine
- **Invoked By**: fusion_adaptive_policy_engine() in each cycle
- **Metrics**: Policy phase confidence and latency

### 6.5 Phase 46: Neural Policy Network
- **Invoked By**: run_neural_policy_training() in each cycle
- **Metrics**: Neural phase confidence and latency

### 6.6 Phase 43: Trust Graph System
- **Invoked By**: fusion_trust_scoring_engine() in each cycle
- **Metrics**: Trust phase confidence and latency

### 6.7 Phase 45: Explainability Layer
- **Invoked By**: generate_explanation() in each cycle
- **Metrics**: Explainability phase confidence and latency

---

## 7. Troubleshooting Guide

### 7.1 Campaign Fails to Start

**Symptom**: "Missing authorization header" or "Unauthorized" error

**Causes**:
- Not logged in as platform admin
- Session token expired
- is_platform_admin flag not set

**Resolution**:
```sql
-- Verify admin status
SELECT id, email, is_platform_admin, role 
FROM profiles 
WHERE id = auth.uid();

-- Set admin flag if needed
UPDATE profiles 
SET is_platform_admin = true 
WHERE email = 'admin@example.com';
```

### 7.2 Campaign Completes with All Errors

**Symptom**: errors_detected = total_iterations

**Causes**:
- One or more Phase 48 functions missing or broken
- Database permissions issue
- RLS policies blocking function execution

**Resolution**:
```sql
-- Test each phase function individually
SELECT * FROM run_full_system_simulation(5);
SELECT * FROM fusion_governance_engine();
SELECT * FROM fusion_adaptive_policy_engine();
SELECT * FROM run_neural_policy_training();
SELECT * FROM fusion_trust_scoring_engine();
SELECT * FROM generate_explanation(gen_random_uuid(), 'test', '{}');

-- Check for errors in each
```

### 7.3 Benchmarks Not Appearing in Dashboard

**Symptom**: Dashboard shows "No benchmarks found"

**Causes**:
- RLS policies blocking SELECT
- Wrong session_id filter
- Data not committed to database

**Resolution**:
```sql
-- Check if benchmarks exist
SELECT COUNT(*) FROM fusion_e2e_benchmarks;

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'fusion_e2e_benchmarks';

-- Verify user can read
SELECT * FROM fusion_e2e_benchmarks LIMIT 1;
```

### 7.4 Edge Function Timeout

**Symptom**: Request times out after 60 seconds

**Causes**:
- Too many cycles requested
- Individual phase functions taking too long
- Database connection issues

**Resolution**:
- Reduce cycle count to <50
- Check Phase 48 function performance
- Monitor Supabase logs for slow queries

### 7.5 Charts Not Rendering

**Symptom**: Empty chart areas or "Loading..." indefinitely

**Causes**:
- No data in benchmarks table
- Recharts dependency missing
- Data format mismatch

**Resolution**:
- Run at least one campaign to populate data
- Check browser console for errors
- Verify Recharts installed: `npm list recharts`

---

## 8. Success Criteria

Phase 49 is considered successfully deployed when:

- ✅ Database migration 059 applied without errors
- ✅ All 3 tables exist with correct schemas
- ✅ run_structured_e2e_campaign() function executes successfully
- ✅ e2e-campaign-engine Edge Function deployed and reachable
- ✅ Admin dashboard accessible at /e2e-campaign
- ✅ Functional campaign (10 cycles) completes with 60 benchmarks
- ✅ Performance campaign (50 cycles) completes within 5 minutes
- ✅ Resilience campaign (15 cycles) injects 5 anomalies
- ✅ All 5 KPI cards display correct metrics
- ✅ All 4 charts render with data
- ✅ Filters and CSV export work correctly
- ✅ No lint errors in E2ECampaign.tsx
- ✅ CI checks pass on PR #84

---

## 9. Next Steps

After Phase 49 validation:

1. **Merge PR #84** to main branch
2. **Apply migration 059** to production database
3. **Deploy Edge Function** to production
4. **Monitor Performance**: Track latency and error rates
5. **User Training**: Document campaign usage for platform admins
6. **Phase 50 Planning**: Consider async execution for very large campaigns

---

## 10. Appendix: Manual Testing Commands

### A. Database Testing

```sql
-- Test functional campaign
SELECT * FROM run_structured_e2e_campaign('functional', 5);

-- Test performance campaign
SELECT * FROM run_structured_e2e_campaign('performance', 10);

-- Test resilience campaign
SELECT * FROM run_structured_e2e_campaign('resilience', 5);

-- View recent sessions
SELECT * FROM fusion_e2e_sessions 
WHERE test_mode IS NOT NULL 
ORDER BY started_at DESC 
LIMIT 5;

-- View recent benchmarks
SELECT * FROM fusion_e2e_benchmarks 
ORDER BY created_at DESC 
LIMIT 30;

-- View anomalies
SELECT * FROM fusion_e2e_anomalies 
ORDER BY created_at DESC 
LIMIT 10;

-- Calculate aggregate metrics
SELECT 
  test_mode,
  COUNT(DISTINCT id) as total_sessions,
  AVG(avg_confidence) as overall_avg_confidence,
  AVG(avg_latency_ms) as overall_avg_latency,
  AVG(avg_stability) as overall_avg_stability,
  SUM(errors_detected) as total_errors
FROM fusion_e2e_sessions
WHERE test_mode IS NOT NULL
GROUP BY test_mode;
```

### B. Edge Function Testing

```bash
# Get auth token (from browser dev tools after login)
TOKEN="<your_bearer_token>"

# Test POST - Functional campaign
curl -X POST \
  https://ygvkegcstaowikessigx.supabase.co/functions/v1/e2e-campaign-engine \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test_mode":"functional","cycles":5}'

# Test GET - Recent sessions
curl -X GET \
  "https://ygvkegcstaowikessigx.supabase.co/functions/v1/e2e-campaign-engine?limit=5" \
  -H "Authorization: Bearer $TOKEN"

# Test GET - Specific session
curl -X GET \
  "https://ygvkegcstaowikessigx.supabase.co/functions/v1/e2e-campaign-engine?session_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

### C. Dashboard Testing

1. Open browser to: `https://core314-admin.netlify.app/e2e-campaign`
2. Open browser DevTools (F12)
3. Monitor Network tab for API calls
4. Monitor Console tab for errors
5. Click each button and verify behavior
6. Test all filters and export functionality

---

**Document Version**: 1.0  
**Last Updated**: November 7, 2025  
**Author**: Core314 Development Team  
**Status**: Ready for Validation
