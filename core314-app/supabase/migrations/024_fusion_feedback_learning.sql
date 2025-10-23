-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fusion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id UUID REFERENCES public.automation_hooks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations_master(id) ON DELETE CASCADE,
  score_before NUMERIC,
  score_after NUMERIC,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('success', 'neutral', 'fail')),
  adjustment NUMERIC DEFAULT 0.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_feedback_hook ON public.fusion_feedback(hook_id);
CREATE INDEX IF NOT EXISTS idx_fusion_feedback_user ON public.fusion_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_feedback_integration ON public.fusion_feedback(integration_id);
CREATE INDEX IF NOT EXISTS idx_fusion_feedback_created_at ON public.fusion_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_feedback_type ON public.fusion_feedback(feedback_type);

GRANT ALL ON public.fusion_feedback TO service_role;
GRANT SELECT ON public.fusion_feedback TO authenticated;

COMMENT ON TABLE public.fusion_feedback IS 'Tracks automation outcomes and their impact on fusion scores for adaptive learning';
