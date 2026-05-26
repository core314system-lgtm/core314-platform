
CREATE TABLE IF NOT EXISTS fusion_optimization_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_type TEXT NOT NULL,
  predicted_variance NUMERIC(10,6),
  predicted_stability NUMERIC(10,6),
  optimization_action TEXT NOT NULL CHECK (optimization_action IN ('pre_tune', 'stabilize', 'recalibrate')),
  parameter_delta JSONB,
  efficiency_index NUMERIC(10,6),
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fusion_optimization_events_event_type ON fusion_optimization_events(source_event_type, created_at DESC);
CREATE INDEX idx_fusion_optimization_events_action ON fusion_optimization_events(optimization_action);
CREATE INDEX idx_fusion_optimization_events_applied ON fusion_optimization_events(applied);
CREATE INDEX idx_fusion_optimization_events_created_at ON fusion_optimization_events(created_at DESC);

ALTER TABLE fusion_optimization_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view optimization events"
  ON fusion_optimization_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Platform admins can update optimization events"
  ON fusion_optimization_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

CREATE POLICY "Service role can insert optimization events"
  ON fusion_optimization_events FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Service role can update optimization events"
  ON fusion_optimization_events FOR UPDATE
  TO service_role
  USING (TRUE);

COMMENT ON TABLE fusion_optimization_events IS 'Phase 34: Records optimization recommendations and parameter adjustments made by the Proactive Optimization Engine';
COMMENT ON COLUMN fusion_optimization_events.source_event_type IS 'Type of event that triggered optimization (e.g., reinforcement_spike, variance_trend)';
COMMENT ON COLUMN fusion_optimization_events.predicted_variance IS 'Predicted variance from Phase 29 stability forecast data';
COMMENT ON COLUMN fusion_optimization_events.predicted_stability IS 'Predicted stability from Phase 29 stability forecast data';
COMMENT ON COLUMN fusion_optimization_events.optimization_action IS 'Type of optimization: pre_tune, stabilize, or recalibrate';
COMMENT ON COLUMN fusion_optimization_events.parameter_delta IS 'JSONB object containing parameter adjustments (e.g., {"confidence_weight": +0.03, "feedback_weight": -0.03})';
COMMENT ON COLUMN fusion_optimization_events.efficiency_index IS 'Calculated metric measuring optimization effectiveness';
COMMENT ON COLUMN fusion_optimization_events.applied IS 'TRUE once the optimization has been applied to the CFFE';
