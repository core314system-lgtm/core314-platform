-- ============================================================
-- User Insight Logs - Phase 9.1 Core Beta Insights
-- Tracks when insights are shown to users for internal validation
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_insight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_key TEXT NOT NULL,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_insight_logs_user_id ON public.user_insight_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insight_logs_insight_key ON public.user_insight_logs(insight_key);
CREATE INDEX IF NOT EXISTS idx_user_insight_logs_shown_at ON public.user_insight_logs(shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_insight_logs_user_insight ON public.user_insight_logs(user_id, insight_key, shown_at DESC);

-- Enable RLS
ALTER TABLE public.user_insight_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own insight logs
CREATE POLICY "Users can view own insight logs"
  ON public.user_insight_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own insight logs
CREATE POLICY "Users can insert own insight logs"
  ON public.user_insight_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Platform admins can view all insight logs (for analytics)
CREATE POLICY "Platform admins can view all insight logs"
  ON public.user_insight_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Comments
COMMENT ON TABLE public.user_insight_logs IS 'Logs when Core Beta Insights are shown to users for internal validation and analytics';
COMMENT ON COLUMN public.user_insight_logs.insight_key IS 'Identifier for the insight type (response_drag, meeting_load_vs_responsiveness, execution_bottleneck)';
COMMENT ON COLUMN public.user_insight_logs.metadata IS 'Additional context about the insight shown (e.g., delta_pct, sample_size, confidence)';
