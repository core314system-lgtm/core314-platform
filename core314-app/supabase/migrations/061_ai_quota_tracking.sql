
CREATE TABLE IF NOT EXISTS public.user_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  requests_used INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_usage_user_month ON public.user_ai_usage(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_user_ai_usage_org ON public.user_ai_usage(organization_id);

CREATE OR REPLACE FUNCTION public.get_ai_quota_for_tier(p_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE LOWER(p_tier)
    WHEN 'starter' THEN RETURN 100;
    WHEN 'professional' THEN RETURN 1000;
    WHEN 'enterprise' THEN RETURN -1; -- -1 means unlimited
    ELSE RETURN 0; -- No access for unknown tiers
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.check_ai_quota(
  p_user_id UUID,
  p_tier TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_quota INTEGER;
  v_used INTEGER;
  v_current_month TEXT;
BEGIN
  v_quota := public.get_ai_quota_for_tier(p_tier);
  
  IF v_quota = -1 THEN
    RETURN true;
  END IF;
  
  IF v_quota = 0 THEN
    RETURN false;
  END IF;
  
  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  SELECT requests_used INTO v_used
  FROM public.user_ai_usage
  WHERE user_id = p_user_id AND month_year = v_current_month;
  
  IF v_used IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN v_used < v_quota;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_current_month TEXT;
BEGIN
  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  INSERT INTO public.user_ai_usage (user_id, organization_id, month_year, requests_used, last_request_at)
  VALUES (p_user_id, p_org_id, v_current_month, 1, NOW())
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET
    requests_used = user_ai_usage.requests_used + 1,
    last_request_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_ai_usage_stats(p_user_id UUID)
RETURNS TABLE (
  month_year TEXT,
  requests_used INTEGER,
  quota_limit INTEGER,
  percentage_used NUMERIC
) AS $$
DECLARE
  v_tier TEXT;
  v_quota INTEGER;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM public.profiles
  WHERE id = p_user_id;
  
  v_quota := public.get_ai_quota_for_tier(v_tier);
  
  RETURN QUERY
  SELECT 
    uau.month_year,
    uau.requests_used,
    v_quota AS quota_limit,
    CASE 
      WHEN v_quota = -1 THEN 0 -- Unlimited
      WHEN v_quota = 0 THEN 100 -- No access
      ELSE ROUND((uau.requests_used::NUMERIC / v_quota::NUMERIC) * 100, 2)
    END AS percentage_used
  FROM public.user_ai_usage uau
  WHERE uau.user_id = p_user_id
  ORDER BY uau.month_year DESC
  LIMIT 12; -- Last 12 months
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON public.user_ai_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_quota_for_tier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_quota(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_usage_stats(UUID) TO authenticated;

ALTER TABLE public.user_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
  ON public.user_ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all AI usage in their org"
  ON public.user_ai_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND organization_id = user_ai_usage.organization_id
      AND role IN ('platform_admin', 'admin')
    )
  );

COMMENT ON TABLE public.user_ai_usage IS 'Tracks AI request usage per user per month for quota enforcement';
COMMENT ON FUNCTION public.check_ai_quota(UUID, TEXT) IS 'Check if user has remaining AI quota for current month';
COMMENT ON FUNCTION public.increment_ai_usage(UUID, UUID) IS 'Increment AI usage counter for user';
COMMENT ON FUNCTION public.get_ai_usage_stats(UUID) IS 'Get AI usage statistics for a user across months';
