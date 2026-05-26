
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.beta_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signup_at TIMESTAMPTZ DEFAULT NOW(),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_users_user_id ON public.beta_users(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_users_created_at ON public.beta_users(created_at DESC);

-- ============================================================================
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.beta_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_events_user_id ON public.beta_events(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_events_created_at ON public.beta_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_events_event_type ON public.beta_events(event_type);
CREATE INDEX IF NOT EXISTS idx_beta_events_event_name ON public.beta_events(event_name);

-- ============================================================================
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.beta_feature_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_beta_feature_usage_user_id ON public.beta_feature_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feature_usage_feature_name ON public.beta_feature_usage(feature_name);
CREATE INDEX IF NOT EXISTS idx_beta_feature_usage_last_used ON public.beta_feature_usage(last_used_at DESC);

-- ============================================================================
-- ============================================================================

ALTER TABLE public.beta_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own beta enrollment"
  ON public.beta_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own beta enrollment"
  ON public.beta_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own beta enrollment"
  ON public.beta_users FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all beta users"
  ON public.beta_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert their own events"
  ON public.beta_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own events"
  ON public.beta_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all events"
  ON public.beta_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view their own feature usage"
  ON public.beta_feature_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feature usage"
  ON public.beta_feature_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feature usage"
  ON public.beta_feature_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feature usage"
  ON public.beta_feature_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- ============================================================================
CREATE OR REPLACE VIEW public.beta_events_admin_view AS
SELECT 
  be.id,
  be.user_id,
  p.email,
  p.full_name,
  be.event_type,
  be.event_name,
  be.metadata,
  be.created_at
FROM public.beta_events be
JOIN public.profiles p ON be.user_id = p.id
ORDER BY be.created_at DESC;

ALTER VIEW public.beta_events_admin_view SET (security_invoker = true);

GRANT SELECT ON public.beta_events_admin_view TO authenticated;

-- ============================================================================
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_beta_users_updated_at
  BEFORE UPDATE ON public.beta_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beta_feature_usage_updated_at
  BEFORE UPDATE ON public.beta_feature_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ============================================================================
COMMENT ON TABLE public.beta_users IS 'Tracks beta user enrollment and onboarding completion status';
COMMENT ON TABLE public.beta_events IS 'Logs all user events for analytics (append-only)';
COMMENT ON TABLE public.beta_feature_usage IS 'Tracks feature usage counts and last access times';
COMMENT ON VIEW public.beta_events_admin_view IS 'Admin view of all beta events with user details';
