
ALTER TABLE fusion_audit_log DROP CONSTRAINT IF EXISTS fusion_audit_log_event_type_check;
ALTER TABLE fusion_audit_log ADD CONSTRAINT fusion_audit_log_event_type_check 
  CHECK (event_type IN (
    'manual_recalibration', 'scheduled_recalibration', 'adaptive_trigger', 
    'simulation_run', 'simulation_viewed', 'simulation_deleted',
    'optimization_analyzed', 'optimization_applied', 'optimization_dismissed',
    'global_insight_aggregated', 'insight_viewed', 'recommendation_generated',
    'governance_policy_created', 'governance_policy_updated', 'governance_policy_deleted',
    'governance_auto_review_completed', 'governance_summary_generated',
    'email_sent', 'email_failed', 'email_bounced'
  ));

CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_email_events 
  ON fusion_audit_log(event_type, created_at) 
  WHERE event_type IN ('email_sent', 'email_failed', 'email_bounced');

GRANT SELECT, INSERT ON fusion_audit_log TO authenticated;
GRANT ALL ON fusion_audit_log TO service_role;
