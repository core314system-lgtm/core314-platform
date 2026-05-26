-- ============================================================================
-- TIER-0 LAUNCH BLOCKER: RLS BILLING ENFORCEMENT
-- Migration 132: Wire is_user_entitled() into RLS policies for all paid tables
-- ============================================================================
-- 
-- This migration enforces billing at the database level by adding
-- is_user_entitled() checks to RLS policies for all paid-access tables.
--
-- ENFORCEMENT RULES:
-- 1. Trial expiration immediately blocks access
-- 2. Paid users retain access
-- 3. Admin + beta users bypass subscription check (via is_user_entitled())
-- 4. All enforcement is database-level (RLS)
--
-- TABLES MODIFIED:
-- - Integration data tables
-- - Metrics/intelligence tables  
-- - AI/automation tables
-- - Decision/orchestration tables
-- - User data tables (excluding profiles which has special handling)
-- ============================================================================

-- ============================================================================
-- HELPER: Create a reusable policy check function
-- This wraps is_user_entitled() for cleaner policy definitions
-- ============================================================================

CREATE OR REPLACE FUNCTION check_billing_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(is_user_entitled(auth.uid()), FALSE);
$$;

COMMENT ON FUNCTION check_billing_access IS 
    'Tier-0: RLS helper that checks if current user has valid subscription/trial/beta access';

GRANT EXECUTE ON FUNCTION check_billing_access TO authenticated;

-- ============================================================================
-- PART 1: INTEGRATION DATA TABLES
-- ============================================================================

-- integrations table
DO $$
BEGIN
    -- Drop existing SELECT policy if it exists
    DROP POLICY IF EXISTS "Users can view own integrations" ON integrations;
    DROP POLICY IF EXISTS "Users can view integrations with billing" ON integrations;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view integrations with billing"
    ON integrations FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- user_integrations table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own user_integrations" ON user_integrations;
    DROP POLICY IF EXISTS "Users can view user_integrations with billing" ON user_integrations;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view user_integrations with billing"
    ON user_integrations FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- integration_configs table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own integration_configs" ON integration_configs;
    DROP POLICY IF EXISTS "Users can view integration_configs with billing" ON integration_configs;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view integration_configs with billing"
    ON integration_configs FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- integration_tokens table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own integration_tokens" ON integration_tokens;
    DROP POLICY IF EXISTS "Users can view integration_tokens with billing" ON integration_tokens;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view integration_tokens with billing"
    ON integration_tokens FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- integration_health_logs table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own integration_health_logs" ON integration_health_logs;
    DROP POLICY IF EXISTS "Users can view integration_health_logs with billing" ON integration_health_logs;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view integration_health_logs with billing"
    ON integration_health_logs FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- integration_secrets table (if exists)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own integration_secrets" ON integration_secrets;
    DROP POLICY IF EXISTS "Users can view integration_secrets with billing" ON integration_secrets;
    
    CREATE POLICY "Users can view integration_secrets with billing"
        ON integration_secrets FOR SELECT
        USING (
            user_id = auth.uid() 
            AND check_billing_access()
        );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- integration_maturity table (if exists)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own integration_maturity" ON integration_maturity;
    DROP POLICY IF EXISTS "Users can view integration_maturity with billing" ON integration_maturity;
    
    CREATE POLICY "Users can view integration_maturity with billing"
        ON integration_maturity FOR SELECT
        USING (
            user_id = auth.uid() 
            AND check_billing_access()
        );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- integration_readiness table (if exists)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own integration_readiness" ON integration_readiness;
    DROP POLICY IF EXISTS "Users can view integration_readiness with billing" ON integration_readiness;
    
    CREATE POLICY "Users can view integration_readiness with billing"
        ON integration_readiness FOR SELECT
        USING (
            user_id = auth.uid() 
            AND check_billing_access()
        );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- integration_insights table (if exists)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own integration_insights" ON integration_insights;
    DROP POLICY IF EXISTS "Users can view integration_insights with billing" ON integration_insights;
    
    CREATE POLICY "Users can view integration_insights with billing"
        ON integration_insights FOR SELECT
        USING (
            user_id = auth.uid() 
            AND check_billing_access()
        );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- integration_intelligence table (if exists)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own integration_intelligence" ON integration_intelligence;
    DROP POLICY IF EXISTS "Users can view integration_intelligence with billing" ON integration_intelligence;
    
    CREATE POLICY "Users can view integration_intelligence with billing"
        ON integration_intelligence FOR SELECT
        USING (
            user_id = auth.uid() 
            AND check_billing_access()
        );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================================
-- PART 2: METRICS/INTELLIGENCE TABLES
-- ============================================================================

-- fusion_metrics table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_metrics" ON fusion_metrics;
    DROP POLICY IF EXISTS "Users can view fusion_metrics with billing" ON fusion_metrics;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_metrics with billing"
    ON fusion_metrics FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_scores table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_scores" ON fusion_scores;
    DROP POLICY IF EXISTS "Users can view fusion_scores with billing" ON fusion_scores;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_scores with billing"
    ON fusion_scores FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_score_history table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_score_history" ON fusion_score_history;
    DROP POLICY IF EXISTS "Users can view fusion_score_history with billing" ON fusion_score_history;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_score_history with billing"
    ON fusion_score_history FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_weightings table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_weightings" ON fusion_weightings;
    DROP POLICY IF EXISTS "Users can view fusion_weightings with billing" ON fusion_weightings;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_weightings with billing"
    ON fusion_weightings FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_insights table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_insights" ON fusion_insights;
    DROP POLICY IF EXISTS "Users can view fusion_insights with billing" ON fusion_insights;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_insights with billing"
    ON fusion_insights FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_narratives table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_narratives" ON fusion_narratives;
    DROP POLICY IF EXISTS "Users can view fusion_narratives with billing" ON fusion_narratives;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_narratives with billing"
    ON fusion_narratives FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_simulations table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_simulations" ON fusion_simulations;
    DROP POLICY IF EXISTS "Users can view fusion_simulations with billing" ON fusion_simulations;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_simulations with billing"
    ON fusion_simulations FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_optimizations table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_optimizations" ON fusion_optimizations;
    DROP POLICY IF EXISTS "Users can view fusion_optimizations with billing" ON fusion_optimizations;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_optimizations with billing"
    ON fusion_optimizations FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_global_insights table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_global_insights" ON fusion_global_insights;
    DROP POLICY IF EXISTS "Users can view fusion_global_insights with billing" ON fusion_global_insights;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_global_insights with billing"
    ON fusion_global_insights FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_feedback table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_feedback" ON fusion_feedback;
    DROP POLICY IF EXISTS "Users can view fusion_feedback with billing" ON fusion_feedback;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_feedback with billing"
    ON fusion_feedback FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_audit_log table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_audit_log" ON fusion_audit_log;
    DROP POLICY IF EXISTS "Users can view fusion_audit_log with billing" ON fusion_audit_log;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_audit_log with billing"
    ON fusion_audit_log FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_automation_rules table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_automation_rules" ON fusion_automation_rules;
    DROP POLICY IF EXISTS "Users can view fusion_automation_rules with billing" ON fusion_automation_rules;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_automation_rules with billing"
    ON fusion_automation_rules FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_action_log table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_action_log" ON fusion_action_log;
    DROP POLICY IF EXISTS "Users can view fusion_action_log with billing" ON fusion_action_log;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_action_log with billing"
    ON fusion_action_log FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- fusion_visual_cache table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own fusion_visual_cache" ON fusion_visual_cache;
    DROP POLICY IF EXISTS "Users can view fusion_visual_cache with billing" ON fusion_visual_cache;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view fusion_visual_cache with billing"
    ON fusion_visual_cache FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- daily_metrics table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own daily_metrics" ON daily_metrics;
    DROP POLICY IF EXISTS "Users can view daily_metrics with billing" ON daily_metrics;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view daily_metrics with billing"
    ON daily_metrics FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- kpi_snapshots table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own kpi_snapshots" ON kpi_snapshots;
    DROP POLICY IF EXISTS "Users can view kpi_snapshots with billing" ON kpi_snapshots;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view kpi_snapshots with billing"
    ON kpi_snapshots FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- auto_metrics table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own auto_metrics" ON auto_metrics;
    DROP POLICY IF EXISTS "Users can view auto_metrics with billing" ON auto_metrics;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view auto_metrics with billing"
    ON auto_metrics FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- metric_data_cache table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own metric_data_cache" ON metric_data_cache;
    DROP POLICY IF EXISTS "Users can view metric_data_cache with billing" ON metric_data_cache;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view metric_data_cache with billing"
    ON metric_data_cache FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- PART 3: AI/AUTOMATION TABLES
-- ============================================================================

-- ai_agents table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own ai_agents" ON ai_agents;
    DROP POLICY IF EXISTS "Users can view ai_agents with billing" ON ai_agents;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view ai_agents with billing"
    ON ai_agents FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ai_tasks table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own ai_tasks" ON ai_tasks;
    DROP POLICY IF EXISTS "Users can view ai_tasks with billing" ON ai_tasks;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view ai_tasks with billing"
    ON ai_tasks FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ai_reasoning_traces table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own ai_reasoning_traces" ON ai_reasoning_traces;
    DROP POLICY IF EXISTS "Users can view ai_reasoning_traces with billing" ON ai_reasoning_traces;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view ai_reasoning_traces with billing"
    ON ai_reasoning_traces FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ai_support_logs table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own ai_support_logs" ON ai_support_logs;
    DROP POLICY IF EXISTS "Users can view ai_support_logs with billing" ON ai_support_logs;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view ai_support_logs with billing"
    ON ai_support_logs FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ai_feedback table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own ai_feedback" ON ai_feedback;
    DROP POLICY IF EXISTS "Users can view ai_feedback with billing" ON ai_feedback;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view ai_feedback with billing"
    ON ai_feedback FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- automation_rules table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own automation_rules" ON automation_rules;
    DROP POLICY IF EXISTS "Users can view automation_rules with billing" ON automation_rules;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view automation_rules with billing"
    ON automation_rules FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- automation_logs table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own automation_logs" ON automation_logs;
    DROP POLICY IF EXISTS "Users can view automation_logs with billing" ON automation_logs;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view automation_logs with billing"
    ON automation_logs FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- predictive_models table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own predictive_models" ON predictive_models;
    DROP POLICY IF EXISTS "Users can view predictive_models with billing" ON predictive_models;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view predictive_models with billing"
    ON predictive_models FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- prediction_results table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own prediction_results" ON prediction_results;
    DROP POLICY IF EXISTS "Users can view prediction_results with billing" ON prediction_results;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view prediction_results with billing"
    ON prediction_results FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- predictive_alerts table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own predictive_alerts" ON predictive_alerts;
    DROP POLICY IF EXISTS "Users can view predictive_alerts with billing" ON predictive_alerts;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view predictive_alerts with billing"
    ON predictive_alerts FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- PART 4: DECISION/ORCHESTRATION TABLES
-- ============================================================================

-- decision_events table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own decision_events" ON decision_events;
    DROP POLICY IF EXISTS "Users can view decision_events with billing" ON decision_events;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view decision_events with billing"
    ON decision_events FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- decision_factors table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own decision_factors" ON decision_factors;
    DROP POLICY IF EXISTS "Users can view decision_factors with billing" ON decision_factors;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view decision_factors with billing"
    ON decision_factors FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- decision_audit_log table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own decision_audit_log" ON decision_audit_log;
    DROP POLICY IF EXISTS "Users can view decision_audit_log with billing" ON decision_audit_log;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view decision_audit_log with billing"
    ON decision_audit_log FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- recommendation_queue table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own recommendation_queue" ON recommendation_queue;
    DROP POLICY IF EXISTS "Users can view recommendation_queue with billing" ON recommendation_queue;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view recommendation_queue with billing"
    ON recommendation_queue FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- orchestration_flows table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own orchestration_flows" ON orchestration_flows;
    DROP POLICY IF EXISTS "Users can view orchestration_flows with billing" ON orchestration_flows;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view orchestration_flows with billing"
    ON orchestration_flows FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- execution_queue table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own execution_queue" ON execution_queue;
    DROP POLICY IF EXISTS "Users can view execution_queue with billing" ON execution_queue;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view execution_queue with billing"
    ON execution_queue FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- execution_log table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own execution_log" ON execution_log;
    DROP POLICY IF EXISTS "Users can view execution_log with billing" ON execution_log;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view execution_log with billing"
    ON execution_log FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- escalation_rules table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own escalation_rules" ON escalation_rules;
    DROP POLICY IF EXISTS "Users can view escalation_rules with billing" ON escalation_rules;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view escalation_rules with billing"
    ON escalation_rules FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- escalation_events table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own escalation_events" ON escalation_events;
    DROP POLICY IF EXISTS "Users can view escalation_events with billing" ON escalation_events;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view escalation_events with billing"
    ON escalation_events FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- PART 5: USER DATA TABLES
-- ============================================================================

-- user_goals table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own user_goals" ON user_goals;
    DROP POLICY IF EXISTS "Users can view user_goals with billing" ON user_goals;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view user_goals with billing"
    ON user_goals FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- user_quality_scores table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own user_quality_scores" ON user_quality_scores;
    DROP POLICY IF EXISTS "Users can view user_quality_scores with billing" ON user_quality_scores;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view user_quality_scores with billing"
    ON user_quality_scores FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- user_onboarding_progress table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own user_onboarding_progress" ON user_onboarding_progress;
    DROP POLICY IF EXISTS "Users can view user_onboarding_progress with billing" ON user_onboarding_progress;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view user_onboarding_progress with billing"
    ON user_onboarding_progress FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- dashboard_layouts table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own dashboard_layouts" ON dashboard_layouts;
    DROP POLICY IF EXISTS "Users can view dashboard_layouts with billing" ON dashboard_layouts;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view dashboard_layouts with billing"
    ON dashboard_layouts FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- goal_recommendations table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own goal_recommendations" ON goal_recommendations;
    DROP POLICY IF EXISTS "Users can view goal_recommendations with billing" ON goal_recommendations;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view goal_recommendations with billing"
    ON goal_recommendations FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- PART 6: ALERT/NOTIFICATION TABLES
-- ============================================================================

-- alert_rules table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own alert_rules" ON alert_rules;
    DROP POLICY IF EXISTS "Users can view alert_rules with billing" ON alert_rules;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view alert_rules with billing"
    ON alert_rules FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- alert_history table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own alert_history" ON alert_history;
    DROP POLICY IF EXISTS "Users can view alert_history with billing" ON alert_history;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view alert_history with billing"
    ON alert_history FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- notification_channels table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own notification_channels" ON notification_channels;
    DROP POLICY IF EXISTS "Users can view notification_channels with billing" ON notification_channels;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view notification_channels with billing"
    ON notification_channels FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- alert_channel_preferences table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own alert_channel_preferences" ON alert_channel_preferences;
    DROP POLICY IF EXISTS "Users can view alert_channel_preferences with billing" ON alert_channel_preferences;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view alert_channel_preferences with billing"
    ON alert_channel_preferences FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- PART 7: MEMORY/INSIGHT TABLES
-- ============================================================================

-- memory_snapshots table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own memory_snapshots" ON memory_snapshots;
    DROP POLICY IF EXISTS "Users can view memory_snapshots with billing" ON memory_snapshots;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view memory_snapshots with billing"
    ON memory_snapshots FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- refinement_history table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own refinement_history" ON refinement_history;
    DROP POLICY IF EXISTS "Users can view refinement_history with billing" ON refinement_history;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view refinement_history with billing"
    ON refinement_history FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- insight_memory table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own insight_memory" ON insight_memory;
    DROP POLICY IF EXISTS "Users can view insight_memory with billing" ON insight_memory;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view insight_memory with billing"
    ON insight_memory FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- PART 8: SYSTEM HEALTH/ANOMALY TABLES
-- ============================================================================

-- system_health_events table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own system_health_events" ON system_health_events;
    DROP POLICY IF EXISTS "Users can view system_health_events with billing" ON system_health_events;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view system_health_events with billing"
    ON system_health_events FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- anomaly_signals table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own anomaly_signals" ON anomaly_signals;
    DROP POLICY IF EXISTS "Users can view anomaly_signals with billing" ON anomaly_signals;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view anomaly_signals with billing"
    ON anomaly_signals FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- recovery_actions table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own recovery_actions" ON recovery_actions;
    DROP POLICY IF EXISTS "Users can view recovery_actions with billing" ON recovery_actions;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view recovery_actions with billing"
    ON recovery_actions FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- selftest_results table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own selftest_results" ON selftest_results;
    DROP POLICY IF EXISTS "Users can view selftest_results with billing" ON selftest_results;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view selftest_results with billing"
    ON selftest_results FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- PART 9: ENTITLEMENTS TABLE
-- ============================================================================

-- tenant_entitlements table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own tenant_entitlements" ON tenant_entitlements;
    DROP POLICY IF EXISTS "Users can view tenant_entitlements with billing" ON tenant_entitlements;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view tenant_entitlements with billing"
    ON tenant_entitlements FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- entitlement_usage table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own entitlement_usage" ON entitlement_usage;
    DROP POLICY IF EXISTS "Users can view entitlement_usage with billing" ON entitlement_usage;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view entitlement_usage with billing"
    ON entitlement_usage FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- PART 10: SUPPORT TABLES
-- ============================================================================

-- support_tickets table
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own support_tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Users can view support_tickets with billing" ON support_tickets;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view support_tickets with billing"
    ON support_tickets FOR SELECT
    USING (
        user_id = auth.uid() 
        AND check_billing_access()
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION check_billing_access IS 
    'Tier-0 Launch Blocker: RLS helper function that enforces billing access. Returns TRUE for users with active subscription, valid trial, beta access, or admin role.';
