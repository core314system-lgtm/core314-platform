-- =============================================
-- Procuvex: Beta Readiness Migration
-- Run this in Supabase SQL editor
-- =============================================

-- 1. Add beta agreement columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS beta_agreement_accepted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS beta_agreement_version text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz DEFAULT NULL;

-- 2. Create email_delivery_log table for enhanced monitoring
-- (Separate from email_tracking which is RFQ-specific)
CREATE TABLE IF NOT EXISTS email_delivery_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email_type text NOT NULL, -- 'welcome', 'invite', 'rfq', 'password_reset', 'trial_reminder'
  recipient_email text NOT NULL,
  sendgrid_message_id text,
  status text DEFAULT 'sent', -- sent, delivered, bounced, dropped, spam_report
  bounce_reason text,
  created_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  bounced_at timestamptz
);

ALTER TABLE email_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_delivery_log_org_access ON email_delivery_log;
CREATE POLICY email_delivery_log_org_access ON email_delivery_log FOR ALL
  USING (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT current_org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_email_delivery_log_org_status
  ON email_delivery_log (org_id, status, created_at DESC);

-- 3. For existing users who should not see the beta agreement modal,
-- set their acceptance date to now (they were already using the platform)
-- IMPORTANT: Run this BEFORE onboarding new beta testers!
UPDATE user_profiles
SET beta_agreement_accepted_at = now(),
    beta_agreement_version = '2026-05-pre-existing'
WHERE beta_agreement_accepted_at IS NULL;
