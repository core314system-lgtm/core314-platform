-- =============================================
-- Procuvex: Founding Partner Program
-- Run this in Supabase SQL editor
-- =============================================

-- 1. Update beta_invitations status check to include 'applied' and 'declined'
ALTER TABLE beta_invitations DROP CONSTRAINT IF EXISTS beta_invitations_status_check;
ALTER TABLE beta_invitations ADD CONSTRAINT beta_invitations_status_check
  CHECK (status IN ('pending', 'applied', 'accepted', 'declined', 'expired', 'revoked'));

-- 2. Add agreement tracking to beta_invitations
ALTER TABLE beta_invitations
  ADD COLUMN IF NOT EXISTS agreed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicant_name text DEFAULT NULL;

-- 3. Add beta program tracking to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS beta_start_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS beta_coupon_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS beta_coupon_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS beta_program_status text DEFAULT NULL
    CHECK (beta_program_status IS NULL OR beta_program_status IN ('active', 'completed', 'expired', 'claimed'));

-- 4. Create beta_feedback table
CREATE TABLE IF NOT EXISTS beta_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  responses jsonb NOT NULL DEFAULT '{}',
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_user ON beta_feedback (user_id, week_number);

ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own feedback
CREATE POLICY beta_feedback_user_access ON beta_feedback FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
