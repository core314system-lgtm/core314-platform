-- ============================================================
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_time ON public.user_sessions(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON public.user_sessions(status);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
ON public.user_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
ON public.user_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Service role can manage sessions"
ON public.user_sessions FOR ALL
USING (true);

GRANT ALL ON public.user_sessions TO service_role;
GRANT SELECT ON public.user_sessions TO authenticated;

COMMENT ON TABLE public.user_sessions IS 'Tracks user login and logout activity for security monitoring';
COMMENT ON COLUMN public.profiles.two_factor_secret IS 'Encrypted TOTP secret for 2FA';
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether user has verified their email address';
COMMENT ON COLUMN public.profiles.last_login IS 'Timestamp of most recent login';
