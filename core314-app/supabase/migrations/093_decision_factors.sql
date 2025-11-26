
CREATE TABLE IF NOT EXISTS decision_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_event_id UUID REFERENCES decision_events(id) ON DELETE CASCADE,
  
  factor_name TEXT NOT NULL, -- 'revenue_trend', 'cost_efficiency', 'user_satisfaction', etc.
  factor_category TEXT NOT NULL, -- 'financial', 'operational', 'customer', 'technical'
  factor_source TEXT NOT NULL, -- 'telemetry', 'prediction', 'insight', 'manual'
  
  current_value DECIMAL(20,6),
  baseline_value DECIMAL(20,6),
  threshold_value DECIMAL(20,6),
  deviation_percent DECIMAL(10,4), -- Percentage deviation from baseline
  
  weight DECIMAL(5,4) NOT NULL CHECK (weight >= 0 AND weight <= 1), -- Importance weight (0-1)
  raw_score DECIMAL(10,6), -- Unweighted score
  weighted_score DECIMAL(10,6), -- weight * raw_score
  confidence DECIMAL(5,4) CHECK (confidence >= 0 AND confidence <= 1), -- Confidence in this factor
  
  context_tags TEXT[] DEFAULT '{}',
  related_metrics TEXT[] DEFAULT '{}',
  time_window TEXT, -- '7d', '30d', '90d'
  data_quality TEXT CHECK (data_quality IN ('high', 'medium', 'low', 'unknown')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_weight CHECK (weight >= 0 AND weight <= 1),
  CONSTRAINT valid_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX idx_decision_factors_user_id ON decision_factors(user_id);
CREATE INDEX idx_decision_factors_decision_event_id ON decision_factors(decision_event_id);
CREATE INDEX idx_decision_factors_factor_name ON decision_factors(factor_name);
CREATE INDEX idx_decision_factors_factor_category ON decision_factors(factor_category);
CREATE INDEX idx_decision_factors_weight ON decision_factors(weight DESC);
CREATE INDEX idx_decision_factors_weighted_score ON decision_factors(weighted_score DESC);
CREATE INDEX idx_decision_factors_created_at ON decision_factors(created_at DESC);
CREATE INDEX idx_decision_factors_context_tags ON decision_factors USING GIN(context_tags);
CREATE INDEX idx_decision_factors_related_metrics ON decision_factors USING GIN(related_metrics);

ALTER TABLE decision_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_factors_select_policy ON decision_factors
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY decision_factors_insert_policy ON decision_factors
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY decision_factors_update_policy ON decision_factors
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY decision_factors_delete_policy ON decision_factors
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_decision_factors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_factors_updated_at_trigger
  BEFORE UPDATE ON decision_factors
  FOR EACH ROW
  EXECUTE FUNCTION update_decision_factors_updated_at();

CREATE OR REPLACE FUNCTION calculate_weighted_score(
  p_raw_score DECIMAL,
  p_weight DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN p_raw_score * p_weight;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_top_decision_factors(
  p_decision_event_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  factor_name TEXT,
  factor_category TEXT,
  weighted_score DECIMAL,
  confidence DECIMAL,
  weight DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    df.factor_name,
    df.factor_category,
    df.weighted_score,
    df.confidence,
    df.weight
  FROM decision_factors df
  WHERE df.decision_event_id = p_decision_event_id
  ORDER BY df.weighted_score DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE decision_factors IS 'Stores weighted KPIs, confidence scores, and contextual tags for decision analysis';
COMMENT ON COLUMN decision_factors.factor_name IS 'Unique identifier for the factor (e.g., revenue_trend, cost_efficiency)';
COMMENT ON COLUMN decision_factors.weight IS 'Importance weight for this factor (0-1), sum of all weights should be 1';
COMMENT ON COLUMN decision_factors.weighted_score IS 'Final score: weight * raw_score';
COMMENT ON COLUMN decision_factors.confidence IS 'Confidence level in this factor measurement (0-1)';
COMMENT ON COLUMN decision_factors.data_quality IS 'Quality assessment of underlying data: high, medium, low, unknown';
