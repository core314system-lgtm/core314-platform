-- Add code_verifier column for PKCE support
ALTER TABLE public.oauth_states 
ADD COLUMN IF NOT EXISTS code_verifier TEXT;

COMMENT ON COLUMN public.oauth_states.code_verifier IS 'PKCE code verifier for secure OAuth token exchange';
