
CREATE TABLE IF NOT EXISTS refinement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES predictive_models(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refinement_type TEXT NOT NULL, -- 'accuracy_improvement', 'trend_correction', 'confidence_recalibration'
  prev_accuracy NUMERIC NOT NULL,
  new_accuracy NUMERIC NOT NULL,
  accuracy_delta NUMERIC GENERATED ALWAYS AS (new_accuracy - prev_accuracy) STORED,
  prev_mae NUMERIC,
  new_mae NUMERIC,
  prev_rmse NUMERIC,
  new_rmse NUMERIC,
  adjustments JSONB NOT NULL, -- Store specific adjustments made (weights, hyperparameters, etc.)
  deviation_detected NUMERIC, -- Percentage deviation that triggered refinement
  samples_analyzed INTEGER NOT NULL,
  refinement_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refinement_history_model_id ON refinement_history(model_id);
CREATE INDEX idx_refinement_history_user_id ON refinement_history(user_id);
CREATE INDEX idx_refinement_history_created_at ON refinement_history(created_at DESC);
CREATE INDEX idx_refinement_history_refinement_type ON refinement_history(refinement_type);
CREATE INDEX idx_refinement_history_composite ON refinement_history(model_id, created_at DESC);

ALTER TABLE refinement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY refinement_history_select_policy ON refinement_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY refinement_history_insert_policy ON refinement_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY refinement_history_update_policy ON refinement_history
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY refinement_history_delete_policy ON refinement_history
  FOR DELETE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE refinement_history;

COMMENT ON TABLE refinement_history IS 'Phase 4: Tracks model accuracy improvements and adjustments for adaptive refinement';
