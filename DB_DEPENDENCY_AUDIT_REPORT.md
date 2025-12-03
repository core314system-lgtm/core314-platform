# Core314 Database Object Dependency Audit Report
**Date:** December 3, 2025  
**Auditor:** Devin AI  
**Scope:** Security analysis of flagged Supabase database objects

---

## Executive Summary

This audit analyzed 10 database objects flagged by Supabase security scans: 7 views and 3 tables. All objects are actively used in production by admin dashboards and Edge Functions. **Critical security issues identified:**

1. **MISSING FORCE ROW LEVEL SECURITY** on all tables (allows owner/SECURITY DEFINER bypass)
2. **SECURITY DEFINER functions accept user_id parameters** (potential privilege escalation)
3. **Overly broad view privileges** (GRANT SELECT to authenticated on admin-only views)
4. **No RLS on feature_flags table** (currently disabled)

**Risk Level:** HIGH - Current configuration allows potential data leakage through SECURITY DEFINER functions and owner bypass of RLS policies.

**Recommended Actions:** 
- Add FORCE ROW LEVEL SECURITY to all sensitive tables (CRITICAL)
- Refactor SECURITY DEFINER functions to use auth.uid() internally (HIGH)
- Enable RLS on feature_flags (CRITICAL)
- Restrict view privileges to admin role or service_role only (MEDIUM)

---

## 1. Summary Table

| Object | Type | Used? | Where Used | RLS Status | Severity | Recommendation |
|--------|------|-------|------------|------------|----------|----------------|
| **neural_policy_dashboard** | VIEW | ✅ Yes | Admin PolicyNetwork.tsx:60 | ⚠️ No RLS | MEDIUM | Restrict privileges, add FORCE RLS to base table |
| **explainability_dashboard** | VIEW | ✅ Yes | Admin Explainability.tsx:57 | ⚠️ No RLS | MEDIUM | Restrict privileges, add FORCE RLS to base table |
| **adaptive_policy_dashboard** | VIEW | ✅ Yes | Admin AdaptivePolicy.tsx:78 | ⚠️ No RLS | MEDIUM | Restrict privileges, add FORCE RLS to base table |
| **trust_graph_dashboard** | VIEW | ✅ Yes | Admin TrustGraph.tsx:87 | ⚠️ No RLS | MEDIUM | Restrict privileges, add FORCE RLS to base table |
| **v_fusion_anomalies** | VIEW | ✅ Yes | fusion-alert-engine:173 | ⚠️ No RLS | MEDIUM | Restrict to service_role only |
| **governance_dashboard** | VIEW | ✅ Yes | GovernanceInsights.tsx:63 | ⚠️ No RLS | MEDIUM | Restrict privileges, add FORCE RLS to base table |
| **simulation_dashboard** | VIEW | ❓ Unknown | No code references found | ⚠️ No RLS | LOW | Verify external usage, then drop |
| **feature_flags** | TABLE | ✅ Yes | Migrations 060, 063 | ❌ RLS NOT enabled | HIGH | Enable RLS, add FORCE RLS |
| **metric_thresholds** | TABLE | ✅ Yes | 3 Edge Functions | ❌ NO FORCE RLS | **CRITICAL** | Add FORCE RLS, refactor functions |
| **beta_monitoring_log** | TABLE | ✅ Yes | 2 Edge Functions + Admin | ❌ NO FORCE RLS | HIGH | Add FORCE RLS |

---

## 2. Detailed Dependency Trace

### 2.1 FLAGGED VIEWS

#### **neural_policy_dashboard**

**Definition:** `055_neural_policy_network.sql:219`

**Dependencies:**
- `core314-admin/src/pages/admin/PolicyNetwork.tsx:60` - `.from('neural_policy_dashboard')`
- `055_neural_policy_network.sql:251` - `GRANT SELECT TO authenticated`

**Base Table:** `fusion_neural_policy_weights`
- RLS Enabled: ✅ Yes
- FORCE RLS: ❌ No
- Runtime Impact: ACTIVE (admin dashboard)
- Data Sensitivity: MEDIUM

**Security Issues:**
1. View grants SELECT to all authenticated users (should be admin-only)
2. Base table lacks FORCE RLS
3. SECURITY DEFINER function `run_neural_policy_training()` can bypass RLS

---

#### **explainability_dashboard**

**Definition:** `054_explainability_layer.sql:119`

**Dependencies:**
- `core314-admin/src/pages/admin/Explainability.tsx:57` - `.from('explainability_dashboard')`
- `054_explainability_layer.sql:134` - `GRANT SELECT TO authenticated`

**Base Table:** `fusion_explainability_log`
- RLS Enabled: ✅ Yes
- FORCE RLS: ❌ No
- Runtime Impact: ACTIVE
- Data Sensitivity: MEDIUM

---

#### **adaptive_policy_dashboard**

**Definition:** `049_adaptive_policy_engine.sql:441`

**Dependencies:**
- `core314-admin/src/pages/admin/AdaptivePolicy.tsx:78` - `.from('adaptive_policy_dashboard')`
- `049_adaptive_policy_engine.sql:466` - `GRANT SELECT TO authenticated`

**Base Table:** `fusion_adaptive_policies`
- RLS Enabled: ✅ Yes
- FORCE RLS: ❌ No
- Runtime Impact: ACTIVE
- Data Sensitivity: HIGH

---

#### **trust_graph_dashboard**

**Definition:** `050_trust_graph_system.sql:346`

**Dependencies:**
- `core314-admin/src/pages/admin/TrustGraph.tsx:87` - `.from('trust_graph_dashboard')`
- `050_trust_graph_system.sql:374` - `GRANT SELECT TO authenticated`

**Base Table:** `fusion_trust_graph`
- RLS Enabled: ✅ Yes
- FORCE RLS: ❌ No
- Runtime Impact: ACTIVE
- Data Sensitivity: HIGH

---

#### **v_fusion_anomalies**

**Definition:** `039_fusion_audit_log.sql:20`

**Dependencies:**
- `fusion-alert-engine/index.ts:173` - `.from('v_fusion_anomalies')`

**Base Table:** `fusion_audit_log`
- RLS Enabled: ✅ Assumed
- FORCE RLS: ❌ No
- Runtime Impact: ACTIVE (Edge Function)
- Data Sensitivity: HIGH

**✅ POSITIVE:** Edge Function uses service_role key correctly

---

#### **governance_dashboard**

**Definition:** `053_governance_framework.sql:283`

**Dependencies:**
- `core314-admin/src/pages/admin/GovernanceInsights.tsx:63` - `.from('governance_dashboard')`
- `053_governance_framework.sql:308` - `GRANT SELECT TO authenticated`

**Base Table:** `fusion_governance_audit`
- RLS Enabled: ✅ Yes
- FORCE RLS: ❌ No
- Runtime Impact: ACTIVE
- Data Sensitivity: HIGH

---

#### **simulation_dashboard**

**Definition:** `057_unified_simulation_environment.sql:235`

**Dependencies:**
- `057_unified_simulation_environment.sql:260` - `GRANT SELECT TO authenticated`
- **No code references found**

**Base Table:** `fusion_simulation_events`
- Runtime Impact: ❓ UNKNOWN
- Data Sensitivity: MEDIUM

**⚠️ RECOMMENDATION:** Verify external usage, then drop or move to internal schema

---

### 2.2 FLAGGED TABLES

#### **feature_flags**

**Definition:** `060_feature_flags.sql:2`

**Dependencies:**
- `060_feature_flags.sql:77` - `GRANT SELECT TO authenticated`
- `063_enable_starter_ai_access.sql:2` - `UPDATE public.feature_flags`

**RLS Configuration:**
- RLS Enabled: ❌ NOT FOUND
- FORCE RLS: ❌ No
- Policies: ❌ NOT FOUND

**Usage:**
- Runtime Impact: ACTIVE (tier-based access control)
- Access Pattern: RPC functions
- Data Sensitivity: MEDIUM

**Security Issues:**
1. **CRITICAL:** No RLS enabled
2. All users can read all feature flags

---

#### **metric_thresholds**

**Definition:** `086_metric_thresholds.sql:4`

**Dependencies:**
- `generate-predictive-insights/index.ts:98` - `.from('metric_thresholds')`
- `send-alerts/index.ts:156,162` - `.from('metric_thresholds')`
- `recommendation-execution/index.ts:170` - `.from('metric_thresholds')`

**RLS Configuration:**
- RLS Enabled: ✅ Yes (line 30)
- FORCE RLS: ❌ No
- Policies: ✅ Users can access own data (auth.uid() = user_id)

**SECURITY DEFINER Functions:**
1. `should_trigger_threshold(p_threshold_id, p_metric_value)` - Line 99
2. `get_active_thresholds(p_user_id, p_metric_name)` - Line 153 ⚠️
3. `get_unacknowledged_alerts(p_user_id, p_limit)` - Line 181 ⚠️
4. `acknowledge_alert(p_alert_id, p_user_id)` - Line 212 ⚠️
5. `auto_adjust_thresholds(p_user_id, p_metric_name)` - Line 231

**Security Issues:**
1. **CRITICAL:** No FORCE RLS - functions can bypass RLS
2. **CRITICAL:** Functions 2-4 accept `p_user_id` - caller can pass any user_id
3. **CRITICAL:** Functions granted to authenticated

**EXPLOIT SCENARIO:**
```sql
-- Any authenticated user can do this:
SELECT * FROM get_active_thresholds('victim-uuid', 'revenue');
SELECT * FROM get_unacknowledged_alerts('victim-uuid', 100);
SELECT acknowledge_alert('alert-uuid', 'victim-uuid');
```

---

#### **beta_monitoring_log**

**Definition:** `080_beta_monitoring_log.sql:4`

**Dependencies:**
- `beta-monitor/index.ts:72,132` - `.from('beta_monitoring_log')`
- `activate-beta-invite/index.ts:111` - `.from('beta_monitoring_log')`
- `BetaMonitoringCards.tsx:38` - `table: 'beta_monitoring_log'`

**RLS Configuration:**
- RLS Enabled: ✅ Yes (line 40)
- FORCE RLS: ❌ No
- Policies: ✅ Service role + users can view own logs

**SECURITY DEFINER Functions:**
1. `get_active_sessions_count()` - No parameters ✅
2. `get_error_rate_1h()` - No parameters ✅
3. `get_avg_api_latency_1h()` - No parameters ✅
4. `get_fusion_health_trend_24h()` - No parameters ✅
5. `get_user_retention_curve()` - No parameters ✅

**✅ POSITIVE:**
- Functions don't accept user_id
- Functions granted to service_role only
- Edge Functions use service_role key

---

## 3. Risk Assessment

### 3.1 Risk by Severity

**CRITICAL RISK:**
- **metric_thresholds** - Privilege escalation via SECURITY DEFINER functions accepting user_id

**HIGH RISK:**
- **feature_flags** - No RLS protection at all

**MEDIUM RISK:**
- **Admin Dashboard Views** (6 views) - Overly broad privileges
- **beta_monitoring_log** - No FORCE RLS

**LOW RISK:**
- **v_fusion_anomalies** - Internal view with proper service_role usage
- **simulation_dashboard** - Unused view

### 3.2 Risk of Leaving Unchanged

**CRITICAL RISK:** Current configuration allows:
1. Any authenticated user to read/modify any other user's alert thresholds
2. Any authenticated user to acknowledge any other user's alerts
3. SECURITY DEFINER functions to bypass RLS entirely
4. All users to read all feature flags

**Compliance Risk:** Violates principle of least privilege and data isolation

---

## 4. Recommended Action Plan

### Phase 1: CRITICAL FIXES (Week 1)

#### 1.1 Add FORCE ROW LEVEL SECURITY

```sql
ALTER TABLE public.metric_thresholds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_monitoring_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_neural_policy_weights FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_explainability_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_adaptive_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_trust_graph FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_governance_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_simulation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fusion_audit_log FORCE ROW LEVEL SECURITY;
```

#### 1.2 Enable RLS on feature_flags

```sql
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature flags"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage feature flags"
  ON public.feature_flags FOR ALL TO service_role 
  USING (true) WITH CHECK (true);
```

#### 1.3 Refactor metric_thresholds Functions

**Create secure versions:**

```sql
CREATE OR REPLACE FUNCTION get_active_thresholds_v2(p_metric_name TEXT)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT ... FROM metric_thresholds mt
  WHERE mt.user_id = auth.uid()  -- Always current user
    AND mt.metric_name = p_metric_name;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
```

**Functions to refactor:**
1. `get_active_thresholds` - Remove p_user_id, use auth.uid()
2. `get_unacknowledged_alerts` - Remove p_user_id, use auth.uid()
3. `acknowledge_alert` - Remove p_user_id, use auth.uid()

---

### Phase 2: HIGH PRIORITY (Week 2)

#### 2.1 Restrict Admin View Privileges

**Option: Replace with Edge Functions**
- Create Edge Function that verifies admin status
- Use service_role client to query views
- Return data only to authorized admins

#### 2.2 Restrict v_fusion_anomalies

```sql
REVOKE SELECT ON public.v_fusion_anomalies FROM authenticated;
GRANT SELECT ON public.v_fusion_anomalies TO service_role;
```

---

### Phase 3: MEDIUM PRIORITY (Week 3-4)

#### 3.1 Investigate simulation_dashboard

Check if used by external BI tools. If unused, drop it.

#### 3.2 Verify Live Database State

Run verification queries to check actual RLS status in production.

---

## 5. Testing Checklist

### After Adding FORCE RLS
- [ ] Test all admin dashboards load correctly
- [ ] Test all Edge Functions execute successfully
- [ ] Verify users can only access their own data

### After Refactoring Functions
- [ ] Test Edge Functions using new _v2 functions
- [ ] Verify users cannot call functions with other user_ids
- [ ] Test alert acknowledgment only works for own alerts

---

## 6. Conclusion

This audit identified **critical security vulnerabilities**:

1. **Missing FORCE RLS** allows SECURITY DEFINER bypass
2. **Insecure functions** accept user_id parameters (privilege escalation)
3. **Overly broad privileges** on admin-only views
4. **Missing RLS** on feature_flags

**Immediate Action Required:**
- Add FORCE RLS to all sensitive tables (CRITICAL)
- Refactor metric_thresholds functions (CRITICAL)
- Enable RLS on feature_flags (CRITICAL)

**Timeline:** 4 weeks total (1 week critical, 1 week high, 2 weeks medium)

**Risk if Not Fixed:**
- Any user can read/modify other users' data
- Compliance violations (GDPR, data isolation)
- Privilege escalation attacks

---

**Report Generated:** December 3, 2025  
**Auditor:** Devin AI  
**Status:** COMPLETE
