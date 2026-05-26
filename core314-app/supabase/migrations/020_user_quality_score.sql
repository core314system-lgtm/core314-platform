
-- ============================================================================
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_quality_scores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_score INT DEFAULT 0,
  activity_score INT DEFAULT 0,
  feature_usage_score INT DEFAULT 0,
  total_score INT GENERATED ALWAYS AS (onboarding_score + activity_score + feature_usage_score) STORED,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ============================================================================
CREATE INDEX IF NOT EXISTS user_quality_scores_total_score_idx ON public.user_quality_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS user_quality_scores_user_id_idx ON public.user_quality_scores(user_id);
CREATE INDEX IF NOT EXISTS user_quality_scores_last_calculated_idx ON public.user_quality_scores(last_calculated_at DESC);

-- ============================================================================
-- ============================================================================
CREATE TRIGGER update_user_quality_scores_updated_at
  BEFORE UPDATE ON public.user_quality_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ============================================================================
ALTER TABLE public.user_quality_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quality score"
  ON public.user_quality_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all quality scores"
  ON public.user_quality_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role can insert quality scores"
  ON public.user_quality_scores FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Service role can update quality scores"
  ON public.user_quality_scores FOR UPDATE
  USING (false);

-- ============================================================================
-- ============================================================================
COMMENT ON TABLE public.user_quality_scores IS 'Tracks user engagement quality scores based on onboarding completion, activity level, and feature usage';
COMMENT ON COLUMN public.user_quality_scores.onboarding_score IS 'Score based on onboarding completion (0 or 40 points)';
COMMENT ON COLUMN public.user_quality_scores.activity_score IS 'Score based on event activity in last 7 days (0-30 points)';
COMMENT ON COLUMN public.user_quality_scores.feature_usage_score IS 'Score based on total feature usage count (0-30 points)';
COMMENT ON COLUMN public.user_quality_scores.total_score IS 'Computed total score (max 100 points)';
