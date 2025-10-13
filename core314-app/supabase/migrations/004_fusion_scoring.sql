
CREATE TABLE IF NOT EXISTS fusion_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations_master(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_type TEXT CHECK (metric_type IN ('count', 'sum', 'average', 'percentage', 'trend')),
  raw_value NUMERIC,
  normalized_value NUMERIC CHECK (normalized_value >= 0 AND normalized_value <= 1),
  weight NUMERIC DEFAULT 0.2,
  data_source JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, integration_id, metric_name)
);

CREATE TABLE IF NOT EXISTS fusion_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations_master(id) ON DELETE CASCADE,
  fusion_score NUMERIC CHECK (fusion_score >= 0 AND fusion_score <= 100),
  score_breakdown JSONB,
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
  ai_summary TEXT,
  ai_cached_at TIMESTAMP WITH TIME ZONE,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, integration_id)
);

CREATE INDEX idx_fusion_metrics_user_integration ON fusion_metrics(user_id, integration_id);
CREATE INDEX idx_fusion_metrics_synced ON fusion_metrics(synced_at DESC);
CREATE INDEX idx_fusion_scores_user ON fusion_scores(user_id);
CREATE INDEX idx_fusion_scores_calculated ON fusion_scores(calculated_at DESC);

ALTER TABLE fusion_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE fusion_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fusion metrics" ON fusion_metrics
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own fusion metrics" ON fusion_metrics
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own fusion metrics" ON fusion_metrics
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view own fusion scores" ON fusion_scores
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own fusion scores" ON fusion_scores
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own fusion scores" ON fusion_scores
  FOR UPDATE USING (user_id = auth.uid());

CREATE TRIGGER update_fusion_scores_updated_at BEFORE UPDATE ON fusion_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
