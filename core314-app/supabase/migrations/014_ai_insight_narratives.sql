-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fusion_narratives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  data_context JSONB,
  ai_confidence NUMERIC CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_narratives_org ON public.fusion_narratives(organization_id);
CREATE INDEX IF NOT EXISTS idx_fusion_narratives_created ON public.fusion_narratives(created_at DESC);

ALTER TABLE public.fusion_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view narratives in their organizations"
ON public.fusion_narratives FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert narratives"
ON public.fusion_narratives FOR INSERT
TO service_role
WITH CHECK (true);

GRANT ALL ON public.fusion_narratives TO service_role;
GRANT SELECT ON public.fusion_narratives TO authenticated;

COMMENT ON TABLE public.fusion_narratives IS 'AI-generated narrative summaries of fusion intelligence and automation activity';
COMMENT ON COLUMN public.fusion_narratives.data_context IS 'JSON containing the data that was analyzed (fusion scores, metrics, automation activity)';
COMMENT ON COLUMN public.fusion_narratives.ai_confidence IS 'AI-assigned confidence level (0-100) based on data availability and quality';
