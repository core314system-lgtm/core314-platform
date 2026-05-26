-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fusion_global_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aggregation_date TIMESTAMPTZ DEFAULT NOW(),
  aggregated_metrics JSONB NOT NULL,
  top_performing_integrations JSONB,
  avg_optimization_improvement NUMERIC,
  sample_size INTEGER NOT NULL,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_global_insights_date ON public.fusion_global_insights(aggregation_date DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_global_insights_created ON public.fusion_global_insights(created_at DESC);

ALTER TABLE public.fusion_global_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all_global_insights"
ON public.fusion_global_insights FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "service_role_insert_global_insights"
ON public.fusion_global_insights FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "service_role_update_global_insights"
ON public.fusion_global_insights FOR UPDATE
TO service_role
USING (true);

GRANT SELECT ON public.fusion_global_insights TO authenticated;
GRANT ALL ON public.fusion_global_insights TO service_role;

COMMENT ON TABLE public.fusion_global_insights IS 'Anonymized cross-organization performance benchmarks and trends';
COMMENT ON COLUMN public.fusion_global_insights.aggregated_metrics IS 'Anonymized global averages: avg_fusion_score, avg_confidence, avg_variance';
COMMENT ON COLUMN public.fusion_global_insights.top_performing_integrations IS 'Integration names and their average improvement scores (no org identifiers)';
COMMENT ON COLUMN public.fusion_global_insights.avg_optimization_improvement IS 'Average improvement_score across all applied optimizations';
COMMENT ON COLUMN public.fusion_global_insights.sample_size IS 'Number of organizations included in aggregation';
COMMENT ON COLUMN public.fusion_global_insights.ai_summary IS 'GPT-4o-mini generated narrative summarizing global trends';
