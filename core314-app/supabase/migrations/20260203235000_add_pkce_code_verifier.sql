-- Add code_verifier column to oauth_states for PKCE support
-- Required for Salesforce External Client Apps which mandate PKCE

ALTER TABLE public.oauth_states 
ADD COLUMN IF NOT EXISTS code_verifier TEXT;

COMMENT ON COLUMN public.oauth_states.code_verifier IS 'PKCE code verifier for OAuth flows that require it (e.g., Salesforce External Client Apps)';
