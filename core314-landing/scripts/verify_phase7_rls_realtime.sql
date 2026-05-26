-- =====================================================================================
-- Phase 7 RLS and Realtime Verification Script
-- =====================================================================================

-- 1. Check if RLS is enabled on Phase 7 tables
\echo '=== 1. RLS Status for Phase 7 Tables ==='
SELECT 
  relname AS table_name,
  CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END AS rls_status
FROM pg_class
WHERE relname IN (
  'decision_events',
  'system_health_events',
  'anomaly_signals',
  'recovery_actions',
  'selftest_results',
  'integrations_master',
  'user_integrations',
  'integration_registry'
)
ORDER BY relname;

-- 2. List all RLS policies on Phase 7 tables
\echo ''
\echo '=== 2. RLS Policies for Phase 7 Tables ==='
SELECT 
  tablename,
  polname AS policy_name,
  polcmd AS command,
  CASE 
    WHEN qual IS NULL THEN 'No restriction'
    ELSE LEFT(qual, 100) || '...'
  END AS using_clause
FROM pg_policies
WHERE tablename IN (
  'decision_events',
  'system_health_events',
  'anomaly_signals',
  'recovery_actions',
  'selftest_results',
  'integrations_master',
  'user_integrations',
  'integration_registry'
)
ORDER BY tablename, polname;

-- 3. Check Realtime publication for Phase 7 tables
\echo ''
\echo '=== 3. Realtime Publication Status ==='
SELECT 
  tablename,
  CASE 
    WHEN COUNT(*) > 0 THEN 'PUBLISHED'
    ELSE 'NOT PUBLISHED'
  END AS realtime_status
FROM (
  SELECT tablename
  FROM (VALUES 
    ('decision_events'),
    ('system_health_events'),
    ('anomaly_signals'),
    ('recovery_actions'),
    ('selftest_results'),
    ('integrations_master'),
    ('user_integrations'),
    ('integration_registry')
  ) AS t(tablename)
) AS all_tables
LEFT JOIN pg_publication_tables ON 
  pg_publication_tables.tablename = all_tables.tablename
  AND pg_publication_tables.pubname = 'supabase_realtime'
  AND pg_publication_tables.schemaname = 'public'
GROUP BY all_tables.tablename
ORDER BY all_tables.tablename;

-- 4. Check row counts for Phase 7 tables
\echo ''
\echo '=== 4. Row Counts for Phase 7 Tables ==='
SELECT 'decision_events' AS table_name, COUNT(*) AS row_count FROM decision_events
UNION ALL
SELECT 'system_health_events', COUNT(*) FROM system_health_events
UNION ALL
SELECT 'anomaly_signals', COUNT(*) FROM anomaly_signals
UNION ALL
SELECT 'recovery_actions', COUNT(*) FROM recovery_actions
UNION ALL
SELECT 'selftest_results', COUNT(*) FROM selftest_results
UNION ALL
SELECT 'integrations_master', COUNT(*) FROM integrations_master
UNION ALL
SELECT 'user_integrations', COUNT(*) FROM user_integrations
UNION ALL
SELECT 'integration_registry', COUNT(*) FROM integration_registry
ORDER BY table_name;
