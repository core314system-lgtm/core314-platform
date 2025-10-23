-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.integration_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('webhook', 'api_key', 'oauth2')),
  base_url TEXT,
  oauth_authorize_url TEXT,
  oauth_token_url TEXT,
  oauth_scopes TEXT[],
  logo_url TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_registry_service_name ON public.integration_registry(service_name);
CREATE INDEX IF NOT EXISTS idx_integration_registry_auth_type ON public.integration_registry(auth_type);
CREATE INDEX IF NOT EXISTS idx_integration_registry_enabled ON public.integration_registry(is_enabled);

ALTER TABLE public.integration_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view enabled integrations" ON public.integration_registry;
CREATE POLICY "Anyone can view enabled integrations"
ON public.integration_registry FOR SELECT
USING (is_enabled = true);

DROP POLICY IF EXISTS "Admins can manage integrations" ON public.integration_registry;
CREATE POLICY "Admins can manage integrations"
ON public.integration_registry FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

GRANT ALL ON public.integration_registry TO service_role;
GRANT SELECT ON public.integration_registry TO authenticated;

INSERT INTO public.integration_registry (
  service_name,
  display_name,
  auth_type,
  oauth_authorize_url,
  oauth_token_url,
  oauth_scopes,
  logo_url,
  description,
  is_enabled
) VALUES (
  'slack',
  'Slack',
  'oauth2',
  'https://slack.com/oauth/v2/authorize',
  'https://slack.com/api/oauth.v2.access',
  ARRAY['channels:history', 'commands', 'incoming-webhook', 'chat:write'],
  'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg',
  'Team communication and collaboration platform',
  true
) ON CONFLICT (service_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_registry_id UUID NOT NULL REFERENCES public.integration_registry(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user ON public.oauth_states(user_id);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own oauth states" ON public.oauth_states;
CREATE POLICY "Users can manage own oauth states"
ON public.oauth_states FOR ALL
USING (auth.uid() = user_id);

GRANT ALL ON public.oauth_states TO service_role;
GRANT ALL ON public.oauth_states TO authenticated;

CREATE OR REPLACE FUNCTION vault_create_secret(secret TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_id UUID;
BEGIN
  SELECT vault.create_secret(secret) INTO secret_id;
  RETURN secret_id;
END;
$$;

COMMENT ON TABLE public.integration_registry IS 'Dynamic registry of available integrations with auth configuration';
COMMENT ON TABLE public.oauth_states IS 'Temporary storage for OAuth state parameters during authorization flow';
