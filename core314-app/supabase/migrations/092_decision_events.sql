
CREATE TABLE IF NOT EXISTS decision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  decision_type TEXT NOT NULL, -- 'optimization', 'alert', 'recommendation', 'automation'
  trigger_source TEXT NOT NULL, -- 'manual', 'scheduled', 'threshold', 'insight'
  context_data JSONB NOT NULL DEFAULT '{}', -- Input data, metrics, thresholds
  
  reasoning_model TEXT NOT NULL DEFAULT 'gpt-4o', -- AI model used
  reasoning_prompt TEXT, -- Prompt sent to AI
  reasoning_response TEXT, -- Full AI response
  reasoning_tokens INTEGER, -- Token count for cost tracking
  
  factors_analyzed JSONB NOT NULL DEFAULT '[]', -- Array of {factor_name, weight, value, score}
  total_confidence_score DECIMAL(5,4) NOT NULL CHECK (total_confidence_score >= 0 AND total_confidence_score <= 1),
  
  recommended_action TEXT NOT NULL, -- 'approve', 'reject', 'escalate', 'automate'
  action_details JSONB NOT NULL DEFAULT '{}', -- Specific action parameters
  expected_impact TEXT, -- Predicted outcome
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed', 'expired')),
  executed_at TIMESTAMPTZ,
  executed_by UUID REFERENCES auth.users(id),
  execution_result JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Auto-expire pending decisions
  
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  requires_approval BOOLEAN DEFAULT true
);

CREATE INDEX idx_decision_events_user_id ON decision_events(user_id);
CREATE INDEX idx_decision_events_decision_type ON decision_events(decision_type);
CREATE INDEX idx_decision_events_status ON decision_events(status);
CREATE INDEX idx_decision_events_created_at ON decision_events(created_at DESC);
CREATE INDEX idx_decision_events_risk_level ON decision_events(risk_level);
CREATE INDEX idx_decision_events_expires_at ON decision_events(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_decision_events_user_status ON decision_events(user_id, status);
CREATE INDEX idx_decision_events_context_data ON decision_events USING GIN(context_data);
CREATE INDEX idx_decision_events_tags ON decision_events USING GIN(tags);

ALTER TABLE decision_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_events_select_policy ON decision_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY decision_events_insert_policy ON decision_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY decision_events_update_policy ON decision_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY decision_events_delete_policy ON decision_events
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_decision_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_events_updated_at_trigger
  BEFORE UPDATE ON decision_events
  FOR EACH ROW
  EXECUTE FUNCTION update_decision_events_updated_at();

CREATE OR REPLACE FUNCTION expire_old_decision_events()
RETURNS void AS $$
BEGIN
  UPDATE decision_events
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE decision_events IS 'Records all AI reasoning events, inputs, and selected outcomes for the Cognitive Decision Engine';
COMMENT ON COLUMN decision_events.decision_type IS 'Type of decision: optimization, alert, recommendation, automation';
COMMENT ON COLUMN decision_events.factors_analyzed IS 'Array of weighted factors used in decision: [{factor_name, weight, value, score}]';
COMMENT ON COLUMN decision_events.total_confidence_score IS 'Overall confidence in the decision (0-1)';
COMMENT ON COLUMN decision_events.recommended_action IS 'AI-recommended action: approve, reject, escalate, automate';
COMMENT ON COLUMN decision_events.risk_level IS 'Risk assessment: low, medium, high, critical';
