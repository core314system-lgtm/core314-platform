
CREATE TABLE IF NOT EXISTS recommendation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_event_id UUID NOT NULL REFERENCES decision_events(id) ON DELETE CASCADE,
  
  recommendation_type TEXT NOT NULL, -- 'action', 'alert', 'insight', 'optimization'
  recommendation_title TEXT NOT NULL,
  recommendation_description TEXT NOT NULL,
  recommendation_rationale TEXT, -- Why this recommendation was made
  
  action_type TEXT NOT NULL, -- 'send_notification', 'adjust_threshold', 'trigger_workflow', 'create_task'
  action_target TEXT, -- Target system/integration (e.g., 'slack', 'teams', 'email', 'internal')
  action_payload JSONB NOT NULL DEFAULT '{}', -- Specific parameters for the action
  
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  estimated_impact TEXT, -- Expected outcome if executed
  
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  execution_status TEXT NOT NULL DEFAULT 'queued' CHECK (execution_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')),
  execution_attempts INTEGER DEFAULT 0,
  last_execution_attempt TIMESTAMPTZ,
  execution_result JSONB,
  execution_error TEXT,
  completed_at TIMESTAMPTZ,
  
  scheduled_for TIMESTAMPTZ, -- When to execute (if scheduled)
  expires_at TIMESTAMPTZ, -- Auto-expire if not executed by this time
  retry_policy JSONB DEFAULT '{"max_attempts": 3, "backoff_seconds": 60}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_recommendation_queue_user_id ON recommendation_queue(user_id);
CREATE INDEX idx_recommendation_queue_decision_event_id ON recommendation_queue(decision_event_id);
CREATE INDEX idx_recommendation_queue_recommendation_type ON recommendation_queue(recommendation_type);
CREATE INDEX idx_recommendation_queue_approval_status ON recommendation_queue(approval_status);
CREATE INDEX idx_recommendation_queue_execution_status ON recommendation_queue(execution_status);
CREATE INDEX idx_recommendation_queue_priority ON recommendation_queue(priority DESC);
CREATE INDEX idx_recommendation_queue_urgency ON recommendation_queue(urgency);
CREATE INDEX idx_recommendation_queue_scheduled_for ON recommendation_queue(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_recommendation_queue_expires_at ON recommendation_queue(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_recommendation_queue_created_at ON recommendation_queue(created_at DESC);
CREATE INDEX idx_recommendation_queue_user_status ON recommendation_queue(user_id, execution_status);
CREATE INDEX idx_recommendation_queue_tags ON recommendation_queue USING GIN(tags);

ALTER TABLE recommendation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY recommendation_queue_select_policy ON recommendation_queue
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY recommendation_queue_insert_policy ON recommendation_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY recommendation_queue_update_policy ON recommendation_queue
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY recommendation_queue_delete_policy ON recommendation_queue
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_recommendation_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recommendation_queue_updated_at_trigger
  BEFORE UPDATE ON recommendation_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendation_queue_updated_at();

CREATE OR REPLACE FUNCTION get_pending_recommendations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  recommendation_title TEXT,
  recommendation_type TEXT,
  priority INTEGER,
  urgency TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rq.id,
    rq.recommendation_title,
    rq.recommendation_type,
    rq.priority,
    rq.urgency,
    rq.created_at,
    rq.expires_at
  FROM recommendation_queue rq
  WHERE rq.user_id = p_user_id
    AND rq.execution_status = 'queued'
    AND rq.approval_status IN ('pending', 'approved', 'auto_approved')
    AND (rq.expires_at IS NULL OR rq.expires_at > NOW())
  ORDER BY rq.priority DESC, rq.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION expire_old_recommendations()
RETURNS void AS $$
BEGIN
  UPDATE recommendation_queue
  SET execution_status = 'expired',
      updated_at = NOW()
  WHERE execution_status IN ('queued', 'in_progress')
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE recommendation_queue IS 'Pending AI suggestions awaiting human approval or execution';
COMMENT ON COLUMN recommendation_queue.recommendation_type IS 'Type: action, alert, insight, optimization';
COMMENT ON COLUMN recommendation_queue.action_type IS 'Specific action: send_notification, adjust_threshold, trigger_workflow, create_task';
COMMENT ON COLUMN recommendation_queue.action_target IS 'Target system: slack, teams, email, internal';
COMMENT ON COLUMN recommendation_queue.priority IS 'Priority level 1-10 (10 = highest)';
COMMENT ON COLUMN recommendation_queue.urgency IS 'Urgency: low, medium, high, critical';
COMMENT ON COLUMN recommendation_queue.retry_policy IS 'JSON config for retry behavior: {max_attempts, backoff_seconds}';
