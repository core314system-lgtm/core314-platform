-- =============================================================================
-- ADD TRIAL EXPIRATION EMAIL TRACKING COLUMNS
-- Tracks Day 12, 14, and 17 expiration emails separately from onboarding nudges.
-- =============================================================================

ALTER TABLE public.user_activation_state
  ADD COLUMN IF NOT EXISTS trial_expiry_email_day12 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_expiry_email_day14 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_expiry_email_day17 TIMESTAMPTZ;

-- Index for trial expiration check cron job
CREATE INDEX IF NOT EXISTS idx_activation_state_trial_expiry
  ON user_activation_state(user_type, signed_up_at)
  WHERE user_type = 'trial_user' AND email_suppressed = FALSE;

COMMENT ON COLUMN user_activation_state.trial_expiry_email_day12 IS 'When the "2 days left" email was sent';
COMMENT ON COLUMN user_activation_state.trial_expiry_email_day14 IS 'When the "trial expired" email was sent';
COMMENT ON COLUMN user_activation_state.trial_expiry_email_day17 IS 'When the "we miss you" win-back email was sent';
