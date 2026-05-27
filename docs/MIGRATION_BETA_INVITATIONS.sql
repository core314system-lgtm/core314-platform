-- =============================================
-- Procuvex: Beta Tester Invitation System
-- Run this in Supabase SQL editor
-- =============================================

-- 1. Create beta_invitations table
CREATE TABLE IF NOT EXISTS beta_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  claimed_at timestamptz,
  expires_at timestamptz
);

-- 2. Index for token lookups (signup validation)
CREATE INDEX IF NOT EXISTS idx_beta_invitations_token ON beta_invitations (token);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_email ON beta_invitations (email, status);

-- 3. RLS — only global admins manage invitations via Netlify function (service role),
--    but allow anonymous reads on pending tokens for signup validation
ALTER TABLE beta_invitations ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (Netlify functions use service role key)
-- No user-level RLS policies needed since all access goes through Netlify functions
