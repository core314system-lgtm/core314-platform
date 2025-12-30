-- ============================================================
-- Universal Integration Intelligence Contract (UIIC) - Phase 8
-- Every integration must produce normalized metrics, insights, and Fusion contribution
-- ============================================================

-- Table to store computed insights for each integration
CREATE TABLE IF NOT EXISTS public.integration_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  insight_key TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'positive', 'negative')),
  confidence NUMERIC DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_integration_insights_user_id ON public.integration_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_insights_service ON public.integration_insights(service_name);
CREATE INDEX IF NOT EXISTS idx_integration_insights_user_service ON public.integration_insights(user_id, service_name);
CREATE INDEX IF NOT EXISTS idx_integration_insights_computed ON public.integration_insights(computed_at DESC);

-- Enable RLS
ALTER TABLE public.integration_insights ENABLE ROW LEVEL SECURITY;

-- Users can view their own insights
CREATE POLICY "Users can view own integration insights"
  ON public.integration_insights
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update insights (for background jobs)
CREATE POLICY "Service role can manage integration insights"
  ON public.integration_insights
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Table to store normalized intelligence metrics per integration
-- This extends the existing telemetry_metrics pattern for universal coverage
CREATE TABLE IF NOT EXISTS public.integration_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  
  -- Normalized metrics (0-100 scale)
  activity_volume NUMERIC DEFAULT 0,
  participation_level NUMERIC DEFAULT 0,
  responsiveness NUMERIC DEFAULT 0,
  throughput NUMERIC DEFAULT 0,
  
  -- Temporal trends
  week_over_week_change NUMERIC DEFAULT 0,
  trend_direction TEXT DEFAULT 'stable' CHECK (trend_direction IN ('up', 'down', 'stable')),
  
  -- Anomaly detection
  anomaly_score NUMERIC DEFAULT 0,
  anomaly_detected BOOLEAN DEFAULT false,
  
  -- Fusion contribution
  fusion_contribution NUMERIC DEFAULT 0,
  fusion_weight NUMERIC DEFAULT 0.2,
  
  -- Raw data for transparency
  raw_metrics JSONB DEFAULT '{}'::jsonb,
  signals_used TEXT[] DEFAULT '{}',
  
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integration_intelligence_user ON public.integration_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_intelligence_service ON public.integration_intelligence(service_name);
CREATE INDEX IF NOT EXISTS idx_integration_intelligence_user_service ON public.integration_intelligence(user_id, service_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_intelligence_unique ON public.integration_intelligence(user_id, integration_id, service_name);

-- Enable RLS
ALTER TABLE public.integration_intelligence ENABLE ROW LEVEL SECURITY;

-- Users can view their own intelligence data
CREATE POLICY "Users can view own integration intelligence"
  ON public.integration_intelligence
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage intelligence data
CREATE POLICY "Service role can manage integration intelligence"
  ON public.integration_intelligence
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to compute week-over-week change for a metric
CREATE OR REPLACE FUNCTION compute_week_over_week_change(
  p_user_id UUID,
  p_service_name TEXT,
  p_metric_name TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  v_current_week NUMERIC;
  v_previous_week NUMERIC;
  v_change NUMERIC;
BEGIN
  -- Get current week average
  SELECT AVG(metric_value) INTO v_current_week
  FROM telemetry_metrics
  WHERE user_id = p_user_id
    AND source_app = p_service_name
    AND metric_name = p_metric_name
    AND timestamp >= NOW() - INTERVAL '7 days';

  -- Get previous week average
  SELECT AVG(metric_value) INTO v_previous_week
  FROM telemetry_metrics
  WHERE user_id = p_user_id
    AND source_app = p_service_name
    AND metric_name = p_metric_name
    AND timestamp >= NOW() - INTERVAL '14 days'
    AND timestamp < NOW() - INTERVAL '7 days';

  -- Calculate percentage change
  IF v_previous_week IS NOT NULL AND v_previous_week > 0 THEN
    v_change := ((v_current_week - v_previous_week) / v_previous_week) * 100;
  ELSE
    v_change := 0;
  END IF;

  RETURN COALESCE(v_change, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION compute_week_over_week_change(UUID, TEXT, TEXT) TO authenticated;

-- Comments
COMMENT ON TABLE public.integration_insights IS 'Stores human-readable insights generated for each integration per the UIIC contract';
COMMENT ON TABLE public.integration_intelligence IS 'Stores normalized intelligence metrics for each integration per the UIIC contract';
COMMENT ON COLUMN public.integration_intelligence.activity_volume IS 'Normalized activity volume (0-100): messages, tasks, tickets, etc.';
COMMENT ON COLUMN public.integration_intelligence.participation_level IS 'Normalized participation (0-100): active users, channels, projects';
COMMENT ON COLUMN public.integration_intelligence.responsiveness IS 'Normalized responsiveness (0-100): response times, resolution rates';
COMMENT ON COLUMN public.integration_intelligence.throughput IS 'Normalized throughput (0-100): completion rates, merge rates, resolution rates';
COMMENT ON COLUMN public.integration_intelligence.fusion_contribution IS 'This integration''s contribution to the overall Fusion Score';
