
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT UNIQUE NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  allowed_tiers TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(feature_key);

INSERT INTO public.feature_flags (feature_key, feature_name, description, enabled, allowed_tiers) VALUES
  ('conversational_insights', 'Conversational Insight Engine', 'Natural language chat interface for querying system data and receiving AI-powered insights', true, ARRAY['professional', 'enterprise']),
  ('predictive_scenarios', 'Predictive Optimization Engine', 'AI-generated scenario forecasts and what-if analysis for optimization planning', true, ARRAY['professional', 'enterprise']),
  ('ai_recommendations', 'AI Recommendations', 'Intelligent recommendations for system optimization and performance improvements', true, ARRAY['professional', 'enterprise'])
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  allowed_tiers = EXCLUDED.allowed_tiers,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.user_has_feature_access(
  p_user_id UUID,
  p_feature_key TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_tier TEXT;
  v_feature_tiers TEXT[];
  v_feature_enabled BOOLEAN;
BEGIN
  SELECT subscription_tier INTO v_user_tier
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT enabled, allowed_tiers INTO v_feature_enabled, v_feature_tiers
  FROM public.feature_flags
  WHERE feature_key = p_feature_key;

  IF NOT FOUND OR NOT v_feature_enabled THEN
    RETURN false;
  END IF;

  RETURN v_user_tier = ANY(v_feature_tiers);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_features(p_user_id UUID)
RETURNS TABLE (
  feature_key TEXT,
  feature_name TEXT,
  description TEXT,
  has_access BOOLEAN
) AS $$
DECLARE
  v_user_tier TEXT;
BEGIN
  SELECT subscription_tier INTO v_user_tier
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT 
    ff.feature_key,
    ff.feature_name,
    ff.description,
    (ff.enabled AND v_user_tier = ANY(ff.allowed_tiers)) AS has_access
  FROM public.feature_flags ff
  ORDER BY ff.feature_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_feature_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_features(UUID) TO authenticated;

COMMENT ON TABLE public.feature_flags IS 'Feature flags for tier-based access control to AI and premium features';
COMMENT ON FUNCTION public.user_has_feature_access(UUID, TEXT) IS 'Check if a user has access to a specific feature based on their subscription tier';
COMMENT ON FUNCTION public.get_user_features(UUID) IS 'Get all features and their access status for a user';
