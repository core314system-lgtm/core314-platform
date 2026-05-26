-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fusion_simulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  input_parameters JSONB NOT NULL,
  predicted_output JSONB NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_simulations_org ON public.fusion_simulations(organization_id);
CREATE INDEX IF NOT EXISTS idx_fusion_simulations_user ON public.fusion_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_simulations_created ON public.fusion_simulations(created_at DESC);

ALTER TABLE public.fusion_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view simulations in their organizations"
ON public.fusion_simulations FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert simulations"
ON public.fusion_simulations FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can delete their own simulations"
ON public.fusion_simulations FOR DELETE
USING (
  user_id = auth.uid() AND
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

GRANT ALL ON public.fusion_simulations TO service_role;
GRANT SELECT, DELETE ON public.fusion_simulations TO authenticated;

COMMENT ON TABLE public.fusion_simulations IS 'Predictive simulations with AI-generated forecasts based on modified fusion parameters';
COMMENT ON COLUMN public.fusion_simulations.input_parameters IS 'Modified parameters (weights, confidence) used for simulation';
COMMENT ON COLUMN public.fusion_simulations.predicted_output IS 'AI-predicted outcomes (FusionScore, Confidence, Variance)';
