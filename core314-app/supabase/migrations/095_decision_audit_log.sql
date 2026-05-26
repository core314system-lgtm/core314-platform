
CREATE TABLE IF NOT EXISTS decision_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_event_id UUID REFERENCES decision_events(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES recommendation_queue(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL, -- 'decision_created', 'decision_approved', 'decision_rejected', 'recommendation_executed', 'override_applied', 'error_occurred'
  event_category TEXT NOT NULL, -- 'decision', 'approval', 'execution', 'override', 'error'
  event_description TEXT NOT NULL,
  
  actor_id UUID REFERENCES auth.users(id), -- Who performed the action
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'ai', 'automation')),
  actor_ip_address INET,
  actor_user_agent TEXT,
  
  previous_state JSONB, -- State before the action
  new_state JSONB, -- State after the action
  state_diff JSONB, -- Computed difference
  
  decision_type TEXT,
  decision_confidence DECIMAL(5,4),
  factors_involved TEXT[],
  
  is_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_justification TEXT,
  original_recommendation TEXT,
  final_action TEXT,
  
  execution_duration_ms INTEGER, -- How long the action took
  execution_success BOOLEAN,
  execution_error TEXT,
  execution_metadata JSONB DEFAULT '{}',
  
  compliance_flags TEXT[] DEFAULT '{}', -- Flags for compliance review
  security_level TEXT CHECK (security_level IN ('public', 'internal', 'confidential', 'restricted')),
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_decision_audit_log_user_id ON decision_audit_log(user_id);
CREATE INDEX idx_decision_audit_log_decision_event_id ON decision_audit_log(decision_event_id);
CREATE INDEX idx_decision_audit_log_recommendation_id ON decision_audit_log(recommendation_id);
CREATE INDEX idx_decision_audit_log_event_type ON decision_audit_log(event_type);
CREATE INDEX idx_decision_audit_log_event_category ON decision_audit_log(event_category);
CREATE INDEX idx_decision_audit_log_actor_id ON decision_audit_log(actor_id);
CREATE INDEX idx_decision_audit_log_actor_type ON decision_audit_log(actor_type);
CREATE INDEX idx_decision_audit_log_created_at ON decision_audit_log(created_at DESC);
CREATE INDEX idx_decision_audit_log_is_override ON decision_audit_log(is_override) WHERE is_override = true;
CREATE INDEX idx_decision_audit_log_requires_review ON decision_audit_log(requires_review) WHERE requires_review = true;
CREATE INDEX idx_decision_audit_log_compliance_flags ON decision_audit_log USING GIN(compliance_flags);
CREATE INDEX idx_decision_audit_log_tags ON decision_audit_log USING GIN(tags);
CREATE INDEX idx_decision_audit_log_user_event ON decision_audit_log(user_id, event_type, created_at DESC);

ALTER TABLE decision_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_audit_log_select_policy ON decision_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY decision_audit_log_insert_policy ON decision_audit_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() = actor_id);

CREATE POLICY decision_audit_log_no_update ON decision_audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY decision_audit_log_no_delete ON decision_audit_log
  FOR DELETE
  USING (false);

CREATE OR REPLACE FUNCTION log_decision_event(
  p_user_id UUID,
  p_decision_event_id UUID,
  p_event_type TEXT,
  p_event_category TEXT,
  p_event_description TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_actor_type TEXT DEFAULT 'system',
  p_previous_state JSONB DEFAULT NULL,
  p_new_state JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO decision_audit_log (
    user_id,
    decision_event_id,
    event_type,
    event_category,
    event_description,
    actor_id,
    actor_type,
    previous_state,
    new_state,
    metadata
  ) VALUES (
    p_user_id,
    p_decision_event_id,
    p_event_type,
    p_event_category,
    p_event_description,
    COALESCE(p_actor_id, p_user_id),
    p_actor_type,
    p_previous_state,
    p_new_state,
    p_metadata
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_decision_audit_trail(
  p_decision_event_id UUID
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  event_description TEXT,
  actor_type TEXT,
  created_at TIMESTAMPTZ,
  is_override BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dal.id,
    dal.event_type,
    dal.event_description,
    dal.actor_type,
    dal.created_at,
    dal.is_override
  FROM decision_audit_log dal
  WHERE dal.decision_event_id = p_decision_event_id
  ORDER BY dal.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION detect_suspicious_overrides(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  override_count BIGINT,
  avg_confidence_overridden DECIMAL,
  high_confidence_overrides BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as override_count,
    AVG(dal.decision_confidence) as avg_confidence_overridden,
    COUNT(*) FILTER (WHERE dal.decision_confidence > 0.8) as high_confidence_overrides
  FROM decision_audit_log dal
  WHERE dal.user_id = p_user_id
    AND dal.is_override = true
    AND dal.created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE decision_audit_log IS 'Full trace of actions and overrides for compliance and debugging - immutable audit trail';
COMMENT ON COLUMN decision_audit_log.event_type IS 'Specific event: decision_created, decision_approved, decision_rejected, recommendation_executed, override_applied, error_occurred';
COMMENT ON COLUMN decision_audit_log.actor_type IS 'Who/what performed the action: user, system, ai, automation';
COMMENT ON COLUMN decision_audit_log.is_override IS 'True if this event represents a human override of AI recommendation';
COMMENT ON COLUMN decision_audit_log.state_diff IS 'Computed difference between previous_state and new_state for easy review';
COMMENT ON COLUMN decision_audit_log.compliance_flags IS 'Array of compliance tags for regulatory review';
COMMENT ON COLUMN decision_audit_log.security_level IS 'Data classification: public, internal, confidential, restricted';
