-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_registry_id UUID NOT NULL REFERENCES public.integration_registry(id) ON DELETE CASCADE,
  user_integration_id UUID REFERENCES public.user_integrations(id) ON DELETE CASCADE,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  token_type TEXT DEFAULT 'bearer',
  scope TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration_registry_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON public.oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_registry ON public.oauth_tokens(integration_registry_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_integration ON public.oauth_tokens(user_integration_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON public.oauth_tokens(expires_at);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own oauth tokens" ON public.oauth_tokens;
CREATE POLICY "Users can view own oauth tokens"
ON public.oauth_tokens FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own oauth tokens" ON public.oauth_tokens;
CREATE POLICY "Users can insert own oauth tokens"
ON public.oauth_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own oauth tokens" ON public.oauth_tokens;
CREATE POLICY "Users can update own oauth tokens"
ON public.oauth_tokens FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own oauth tokens" ON public.oauth_tokens;
CREATE POLICY "Users can delete own oauth tokens"
ON public.oauth_tokens FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage oauth tokens" ON public.oauth_tokens;
CREATE POLICY "Service role can manage oauth tokens"
ON public.oauth_tokens FOR ALL
TO service_role
WITH CHECK (true);

GRANT ALL ON public.oauth_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_tokens TO authenticated;

COMMENT ON TABLE public.oauth_tokens IS 'OAuth token storage with pgsodium-encrypted secrets';
COMMENT ON COLUMN public.oauth_tokens.access_token_encrypted IS 'Encrypted access token using pgsodium AEAD';
COMMENT ON COLUMN public.oauth_tokens.refresh_token_encrypted IS 'Encrypted refresh token using pgsodium AEAD';
