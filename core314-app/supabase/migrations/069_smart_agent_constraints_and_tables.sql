
-- ============================================================================
-- ============================================================================

ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'info'::text, 
  'warning'::text, 
  'error'::text, 
  'success'::text,
  'alert'::text,      -- Smart Agent alert action
  'notify'::text      -- Smart Agent notify action
]));

COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 
'Allowed notification types: info, warning, error, success (legacy), alert, notify (Smart Agent)';

-- ============================================================================
-- ============================================================================

ALTER TABLE fusion_optimization_events 
DROP CONSTRAINT IF EXISTS fusion_optimization_events_optimization_action_check;

ALTER TABLE fusion_optimization_events 
ADD CONSTRAINT fusion_optimization_events_optimization_action_check 
CHECK (optimization_action = ANY (ARRAY[
  'pre_tune'::text,
  'stabilize'::text,
  'recalibrate'::text,
  'auto'::text,       -- Smart Agent automatic optimization
  'manual'::text,     -- Smart Agent manual optimization
  'scheduled'::text   -- Smart Agent scheduled optimization
]));

COMMENT ON CONSTRAINT fusion_optimization_events_optimization_action_check ON fusion_optimization_events IS 
'Allowed optimization actions: pre_tune, stabilize, recalibrate (legacy), auto, manual, scheduled (Smart Agent)';

-- ============================================================================
-- ============================================================================

ALTER TABLE fusion_audit_log 
DROP CONSTRAINT IF EXISTS fusion_audit_log_event_type_check;

ALTER TABLE fusion_audit_log 
ADD CONSTRAINT fusion_audit_log_event_type_check 
CHECK (event_type = ANY (ARRAY[
  'manual_recalibration'::text,
  'scheduled_recalibration'::text,
  'adaptive_trigger'::text,
  'simulation_run'::text,
  'simulation_viewed'::text,
  'simulation_deleted'::text,
  'optimization_analyzed'::text,
  'optimization_applied'::text,
  'optimization_dismissed'::text,
  'global_insight_aggregated'::text,
  'insight_viewed'::text,
  'recommendation_generated'::text,
  'governance_policy_created'::text,
  'governance_policy_updated'::text,
  'governance_policy_deleted'::text,
  'governance_auto_review_completed'::text,
  'governance_summary_generated'::text,
  'email_sent'::text,
  'email_failed'::text,
  'email_bounced'::text,
  'ai_support_query'::text,
  'ai_support_escalation'::text,
  'ai_feedback_submitted'::text,
  'onboarding_step_completed'::text,
  'onboarding_completed'::text,
  'anomaly_test'::text  -- Smart Agent testing
]));

COMMENT ON CONSTRAINT fusion_audit_log_event_type_check ON fusion_audit_log IS 
'Allowed event types including anomaly_test for Smart Agent testing';

-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS fusion_optimization_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  optimization_event_id UUID REFERENCES fusion_optimization_events(id) ON DELETE SET NULL,
  strategy TEXT NOT NULL,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed', 'failed')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_optimization_results_user_id 
ON fusion_optimization_results(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fusion_optimization_results_rule_id 
ON fusion_optimization_results(rule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fusion_optimization_results_status 
ON fusion_optimization_results(status, created_at DESC);

ALTER TABLE fusion_optimization_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own optimization results"
ON fusion_optimization_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert optimization results"
ON fusion_optimization_results FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can update their own optimization results"
ON fusion_optimization_results FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to optimization results"
ON fusion_optimization_results FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE fusion_optimization_results IS 
'Stores optimization results from Smart Agent automation rules with recommended actions and execution status';

COMMENT ON COLUMN fusion_optimization_results.strategy IS 
'Optimization strategy type: efficiency_boost, fusion_enhancement, integration_recovery, etc.';

COMMENT ON COLUMN fusion_optimization_results.recommended_actions IS 
'Array of recommended actions to improve the metric (JSONB array)';

COMMENT ON COLUMN fusion_optimization_results.result IS 
'Detailed optimization result data including metrics, changes, and outcomes (JSONB)';

COMMENT ON COLUMN fusion_optimization_results.status IS 
'Optimization status: pending (not yet applied), applied (executed), dismissed (user rejected), failed (execution error)';

-- ============================================================================
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'fusion_action_log'
  ) THEN
    RAISE NOTICE 'WARNING: fusion_action_log table does not exist. Creating it now.';
    
    CREATE TABLE fusion_action_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL,
      action_details JSONB DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX idx_fusion_action_log_user_id ON fusion_action_log(user_id, created_at DESC);
    
    ALTER TABLE fusion_action_log ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Service role full access to action log"
    ON fusion_action_log FOR ALL
    USING (auth.role() = 'service_role');
    
    CREATE POLICY "Users can view their own action log"
    ON fusion_action_log FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- ============================================================================
