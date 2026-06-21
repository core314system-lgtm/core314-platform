-- Add token expiry column to referral_partners
-- Tokens expire 7 days after creation/rotation
ALTER TABLE referral_partners
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Set existing tokens to expire 7 days from now
UPDATE referral_partners
  SET token_expires_at = now() + interval '7 days'
  WHERE token_expires_at IS NULL;
