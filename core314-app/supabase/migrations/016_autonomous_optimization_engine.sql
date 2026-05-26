-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fusion_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  optimization_type TEXT NOT NULL CHECK (optimization_type IN ('auto_adjustment', 'recommendation', 'simulation_based')),
  baseline_data JSONB NOT NULL,
  optimized_data JSONB NOT NULL,
  improvement_score NUMERIC NOT NULL CHECK (improvement_score >= 0 AND improvement_score <= 1),
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_optimizations_org ON public.fusion_optimizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_fusion_optimizations_applied ON public.fusion_optimizations(applied);
CREATE INDEX IF NOT EXISTS idx_fusion_optimizations_improvement ON public.fusion_optimizations(improvement_score DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_optimizations_created ON public.fusion_optimizations(created_at DESC);

ALTER TABLE public.fusion_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view optimizations in their organizations"
ON public.fusion_optimizations FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert optimizations"
ON public.fusion_optimizations FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update optimizations"
ON public.fusion_optimizations FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Org admins can delete optimizations"
ON public.fusion_optimizations FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

GRANT ALL ON public.fusion_optimizations TO service_role;
GRANT SELECT, DELETE ON public.fusion_optimizations TO authenticated;

COMMENT ON TABLE public.fusion_optimizations IS 'AI-driven optimization opportunities with baseline vs optimized metrics';
COMMENT ON COLUMN public.fusion_optimizations.baseline_data IS 'Current state snapshot: weights, confidence, fusion_score, variance';
COMMENT ON COLUMN public.fusion_optimizations.optimized_data IS 'Proposed improved state with same structure as baseline_data';
COMMENT ON COLUMN public.fusion_optimizations.improvement_score IS 'Predicted improvement magnitude (0-1 scale)';
COMMENT ON COLUMN public.fusion_optimizations.applied IS 'Whether the optimization was applied to fusion_weightings';
