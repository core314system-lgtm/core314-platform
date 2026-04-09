-- ============================================================================
-- PHASE P1 HARDENING — SCHEDULED JOBS (pg_cron)
-- ============================================================================
-- Activates autonomous monitoring, integrity checks, score refresh,
-- recommendation refresh, and data cleanup via pg_cron.
-- All jobs log results to system_health_logs and alert on failure.
-- ============================================================================

-- Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- PREREQUISITE FUNCTIONS — Required by cron jobs below
-- ============================================================================

-- run_integrity_checks(): Validates data consistency across integration tables
CREATE OR REPLACE FUNCTION run_integrity_checks()
RETURNS TABLE(check_name TEXT, anomaly_count INTEGER, details JSONB) AS $$
BEGIN
  -- Check 1: Orphaned integration_requests (catalog_id pointing to non-existent catalog)
  RETURN QUERY
  SELECT
    'orphaned_integration_requests'::TEXT AS check_name,
    COUNT(*)::INTEGER AS anomaly_count,
    jsonb_build_object('orphaned_ids', COALESCE(jsonb_agg(ir.id), '[]'::jsonb)) AS details
  FROM integration_requests ir
  LEFT JOIN integration_catalog ic ON ir.integration_catalog_id = ic.id
  WHERE ir.integration_catalog_id IS NOT NULL AND ic.id IS NULL;

  -- Check 2: Duplicate normalized keys in integration_catalog
  RETURN QUERY
  SELECT
    'duplicate_catalog_keys'::TEXT,
    COUNT(*)::INTEGER,
    jsonb_build_object('duplicates', COALESCE(jsonb_agg(jsonb_build_object('key', normalized_key, 'count', cnt)), '[]'::jsonb))
  FROM (
    SELECT normalized_key, COUNT(*) AS cnt
    FROM integration_catalog
    GROUP BY normalized_key
    HAVING COUNT(*) > 1
  ) dupes;

  -- Check 3: Aliases pointing to non-existent catalog entries
  RETURN QUERY
  SELECT
    'orphaned_aliases'::TEXT,
    COUNT(*)::INTEGER,
    jsonb_build_object('orphaned_ids', COALESCE(jsonb_agg(ia.id), '[]'::jsonb))
  FROM integration_aliases ia
  LEFT JOIN integration_catalog ic ON ia.integration_catalog_id = ic.id
  WHERE ic.id IS NULL;

  -- Check 4: Commitments referencing non-existent catalog entries
  RETURN QUERY
  SELECT
    'orphaned_commitments'::TEXT,
    COUNT(*)::INTEGER,
    jsonb_build_object('orphaned_ids', COALESCE(jsonb_agg(ico.id), '[]'::jsonb))
  FROM integration_commitments ico
  LEFT JOIN integration_catalog ic ON ico.integration_catalog_id = ic.id
  WHERE ic.id IS NULL;

  -- Check 5: Execution entries with invalid status
  RETURN QUERY
  SELECT
    'invalid_execution_status'::TEXT,
    COUNT(*)::INTEGER,
    jsonb_build_object('invalid_ids', COALESCE(jsonb_agg(ie.id), '[]'::jsonb))
  FROM integration_execution ie
  WHERE ie.status NOT IN ('planned', 'in_progress', 'testing', 'launched', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- cleanup_old_ops_events(): Removes ops_events older than specified days
CREATE OR REPLACE FUNCTION cleanup_old_ops_events(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM ops_events
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 1. INTEGRITY CHECKS — Every 6 hours
-- Runs run_integrity_checks() and logs results + alerts on anomalies
-- ============================================================================
SELECT cron.schedule(
  'integrity-checks-6h',
  '0 */6 * * *',
  $$
  DO $job$
  DECLARE
    v_result RECORD;
    v_total_anomalies INTEGER := 0;
    v_details JSONB := '[]'::JSONB;
  BEGIN
    FOR v_result IN SELECT * FROM run_integrity_checks() LOOP
      v_total_anomalies := v_total_anomalies + v_result.anomaly_count;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'check', v_result.check_name,
        'anomalies', v_result.anomaly_count,
        'details', v_result.details
      ));
    END LOOP;

    -- Log to system_health_logs
    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES (
      'integrity_check',
      CASE WHEN v_total_anomalies > 0 THEN 'failure' ELSE 'success' END,
      CASE WHEN v_total_anomalies > 0
        THEN 'Integrity check found ' || v_total_anomalies || ' anomalies'
        ELSE 'Integrity check passed — no anomalies'
      END,
      jsonb_build_object('total_anomalies', v_total_anomalies, 'checks', v_details)
    );

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES ('integrity_check', 'failure', 'Integrity check failed: ' || SQLERRM,
            jsonb_build_object('error', SQLERRM));
  END $job$;
  $$
);

-- ============================================================================
-- 2. RLS AUDIT — Daily at 2:00 AM UTC
-- Runs rls_audit_check() and logs results + alerts on unprotected tables
-- ============================================================================
SELECT cron.schedule(
  'rls-audit-daily',
  '0 2 * * *',
  $$
  DO $job$
  DECLARE
    v_result RECORD;
    v_unprotected INTEGER := 0;
    v_details JSONB := '[]'::JSONB;
  BEGIN
    FOR v_result IN SELECT * FROM rls_audit_check() LOOP
      IF NOT v_result.rls_enabled THEN
        v_unprotected := v_unprotected + 1;
      END IF;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'table', v_result.table_name,
        'rls_enabled', v_result.rls_enabled,
        'has_policies', v_result.has_policies
      ));
    END LOOP;

    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES (
      'rls_audit',
      CASE WHEN v_unprotected > 0 THEN 'failure' ELSE 'success' END,
      CASE WHEN v_unprotected > 0
        THEN 'RLS audit found ' || v_unprotected || ' unprotected tables'
        ELSE 'RLS audit passed — all tables protected'
      END,
      jsonb_build_object('unprotected_count', v_unprotected, 'tables', v_details)
    );

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES ('rls_audit', 'failure', 'RLS audit failed: ' || SQLERRM,
            jsonb_build_object('error', SQLERRM));
  END $job$;
  $$
);

-- ============================================================================
-- 3. PRIORITY SCORE RECALCULATION — Hourly
-- Recalculates priority_score for all integration_catalog entries
-- ============================================================================
SELECT cron.schedule(
  'recalculate-priority-scores-1h',
  '15 * * * *',
  $$
  DO $job$
  DECLARE
    v_updated INTEGER := 0;
  BEGIN
    WITH score_calc AS (
      SELECT
        ic.id,
        (ic.total_requests * 0.4) +
        (COALESCE((SELECT COUNT(DISTINCT user_id) FROM integration_requests WHERE integration_catalog_id = ic.id), 0) * 0.3) +
        (CASE
          WHEN ic.updated_at > NOW() - INTERVAL '7 days' THEN 20
          WHEN ic.updated_at > NOW() - INTERVAL '30 days' THEN 10
          ELSE 0
        END * 0.2) +
        (COALESCE((SELECT weight FROM integration_category_weights WHERE category = ic.category), 1.0) * 10 * 0.1)
        AS new_score
      FROM integration_catalog ic
    )
    UPDATE integration_catalog
    SET priority_score = score_calc.new_score,
        updated_at = NOW()
    FROM score_calc
    WHERE integration_catalog.id = score_calc.id
      AND ABS(integration_catalog.priority_score - score_calc.new_score) > 0.01;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES ('priority_score_refresh', 'success',
            'Recalculated priority scores: ' || v_updated || ' updated',
            jsonb_build_object('updated_count', v_updated));

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES ('priority_score_refresh', 'failure', 'Score refresh failed: ' || SQLERRM,
            jsonb_build_object('error', SQLERRM));
  END $job$;
  $$
);

-- ============================================================================
-- 4. RECOMMENDATION REGENERATION — Hourly (offset by 30 min from scores)
-- Regenerates integration_recommendations based on current scores
-- ============================================================================
SELECT cron.schedule(
  'regenerate-recommendations-1h',
  '45 * * * *',
  $$
  DO $job$
  DECLARE
    v_generated INTEGER := 0;
  BEGIN
    -- Clear stale recommendations
    DELETE FROM integration_recommendations
    WHERE created_at < NOW() - INTERVAL '24 hours';

    -- Build Now: top 10% by priority score
    INSERT INTO integration_recommendations (integration_catalog_id, type, reason, confidence, metadata)
    SELECT id, 'build_now',
           'Top priority: score ' || ROUND(priority_score::numeric, 1) || ' with ' || total_requests || ' requests',
           LEAST(priority_score / 100.0, 1.0),
           jsonb_build_object('score', priority_score, 'requests', total_requests)
    FROM integration_catalog
    WHERE priority_score >= (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY priority_score) FROM integration_catalog)
      AND total_requests >= 2
    ON CONFLICT (integration_catalog_id, type) DO UPDATE
      SET reason = EXCLUDED.reason, confidence = EXCLUDED.confidence,
          metadata = EXCLUDED.metadata, created_at = NOW();

    -- High Demand: 5+ requests
    INSERT INTO integration_recommendations (integration_catalog_id, type, reason, confidence, metadata)
    SELECT id, 'high_demand',
           total_requests || ' requests from multiple users',
           LEAST(total_requests / 20.0, 1.0),
           jsonb_build_object('requests', total_requests)
    FROM integration_catalog
    WHERE total_requests >= 5
    ON CONFLICT (integration_catalog_id, type) DO UPDATE
      SET reason = EXCLUDED.reason, confidence = EXCLUDED.confidence,
          metadata = EXCLUDED.metadata, created_at = NOW();

    -- Low Priority: score < 5 and < 2 requests
    INSERT INTO integration_recommendations (integration_catalog_id, type, reason, confidence, metadata)
    SELECT id, 'low_priority',
           'Low demand: ' || total_requests || ' requests, score ' || ROUND(priority_score::numeric, 1),
           0.3,
           jsonb_build_object('score', priority_score, 'requests', total_requests)
    FROM integration_catalog
    WHERE priority_score < 5 AND total_requests < 2
    ON CONFLICT (integration_catalog_id, type) DO UPDATE
      SET reason = EXCLUDED.reason, confidence = EXCLUDED.confidence,
          metadata = EXCLUDED.metadata, created_at = NOW();

    GET DIAGNOSTICS v_generated = ROW_COUNT;

    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES ('recommendation_refresh', 'success',
            'Regenerated recommendations',
            jsonb_build_object('generated', v_generated));

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES ('recommendation_refresh', 'failure', 'Recommendation refresh failed: ' || SQLERRM,
            jsonb_build_object('error', SQLERRM));
  END $job$;
  $$
);

-- ============================================================================
-- 5. CLEANUP — Daily at 3:00 AM UTC
-- Cleans up old data: ops_events (30d), system_health_logs (30d),
-- integration_events (60d)
-- ============================================================================
SELECT cron.schedule(
  'cleanup-old-data-daily',
  '0 3 * * *',
  $$
  DO $job$
  DECLARE
    v_ops_deleted INTEGER := 0;
    v_health_deleted INTEGER := 0;
    v_events_deleted INTEGER := 0;
  BEGIN
    -- 1. Cleanup ops_event_log (30 days)
    SELECT cleanup_old_ops_events(30) INTO v_ops_deleted;

    -- 2. Cleanup system_health_logs (30 days)
    DELETE FROM system_health_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_health_deleted = ROW_COUNT;

    -- 3. Cleanup integration_events (60 days)
    DELETE FROM integration_events
    WHERE created_at < NOW() - INTERVAL '60 days';
    GET DIAGNOSTICS v_events_deleted = ROW_COUNT;

    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES ('data_cleanup', 'success',
            'Cleanup complete: ' || v_ops_deleted || ' ops, ' || v_health_deleted || ' health, ' || v_events_deleted || ' integration events deleted',
            jsonb_build_object(
              'ops_events_deleted', v_ops_deleted,
              'health_logs_deleted', v_health_deleted,
              'integration_events_deleted', v_events_deleted
            ));

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO system_health_logs (service, status, message, metadata)
    VALUES ('data_cleanup', 'failure', 'Cleanup failed: ' || SQLERRM,
            jsonb_build_object('error', SQLERRM));
  END $job$;
  $$
);
