
UPDATE public.feature_flags
SET 
  allowed_tiers = ARRAY['starter', 'professional', 'enterprise'],
  updated_at = NOW()
WHERE feature_key IN ('conversational_insights', 'predictive_scenarios', 'ai_recommendations');

COMMENT ON TABLE public.feature_flags IS 'Feature flags for tier-based access control. Starter tier gets AI access with 100 requests/month quota, Professional gets 1000/month, Enterprise gets unlimited.';
