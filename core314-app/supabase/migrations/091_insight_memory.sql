
CREATE TABLE IF NOT EXISTS insight_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_text TEXT NOT NULL,
  insight_category TEXT NOT NULL, -- 'trend', 'anomaly', 'forecast', 'recommendation'
  related_metrics TEXT[] NOT NULL, -- Array of metric names
  context_data JSONB NOT NULL, -- Store metric values, timestamps, conditions
  impact_score NUMERIC NOT NULL CHECK (impact_score >= 0 AND impact_score <= 1),
  confidence_before NUMERIC NOT NULL CHECK (confidence_before >= 0 AND confidence_before <= 1),
  confidence_after NUMERIC CHECK (confidence_after >= 0 AND confidence_after <= 1),
  user_feedback TEXT, -- 'accepted', 'rejected', 'modified', null
  feedback_timestamp TIMESTAMPTZ,
  reuse_count INTEGER DEFAULT 0, -- How many times this insight pattern was reused
  last_reused_at TIMESTAMPTZ,
  similarity_threshold NUMERIC DEFAULT 0.8, -- Threshold for matching similar contexts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insight_memory_user_id ON insight_memory(user_id);
CREATE INDEX idx_insight_memory_category ON insight_memory(insight_category);
CREATE INDEX idx_insight_memory_created_at ON insight_memory(created_at DESC);
CREATE INDEX idx_insight_memory_impact_score ON insight_memory(impact_score DESC);
CREATE INDEX idx_insight_memory_reuse_count ON insight_memory(reuse_count DESC);
CREATE INDEX idx_insight_memory_related_metrics ON insight_memory USING GIN(related_metrics);
CREATE INDEX idx_insight_memory_context_data ON insight_memory USING GIN(context_data);
CREATE INDEX idx_insight_memory_composite ON insight_memory(user_id, insight_category, created_at DESC);

ALTER TABLE insight_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY insight_memory_select_policy ON insight_memory
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY insight_memory_insert_policy ON insight_memory
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY insight_memory_update_policy ON insight_memory
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY insight_memory_delete_policy ON insight_memory
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_insight_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insight_memory_updated_at_trigger
  BEFORE UPDATE ON insight_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_insight_memory_updated_at();

COMMENT ON TABLE insight_memory IS 'Phase 4: Stores historical insight context for memory reinforcement and pattern reuse';
