-- Migration: 136_admin_messaging_system.sql
-- Description: Creates admin messaging log table for beta invitations and follow-ups
-- Author: Devin AI
-- Date: 2026-01-13

-- =============================================================================
-- ADMIN MESSAGING LOG TABLE
-- =============================================================================
-- Stores all admin-initiated messages (invitations, reminders, follow-ups)
-- Every send must be logged for audit trail

CREATE TABLE IF NOT EXISTS admin_messaging_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Admin who sent the message
  admin_user_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Recipient information
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_company TEXT,
  
  -- Message details
  template_name TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('beta_invite', 'beta_reminder', 'beta_followup', 'reengagement', 'checkin')),
  
  -- Send status
  send_status TEXT NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  
  -- SendGrid tracking
  sendgrid_message_id TEXT,
  
  -- Context (optional JSON for additional data)
  context JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT admin_messaging_log_template_not_empty CHECK (template_name <> ''),
  CONSTRAINT admin_messaging_log_email_not_empty CHECK (recipient_email <> '')
);

-- =============================================================================
-- BETA INVITATIONS TABLE
-- =============================================================================
-- Tracks beta invitations sent by admins (separate from beta_applications)
-- This is for OUTBOUND invitations, not inbound applications

CREATE TABLE IF NOT EXISTS beta_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Invitation details
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'expired', 'revoked')),
  
  -- Invitation token for secure acceptance
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  
  -- Admin who sent the invitation
  invited_by UUID NOT NULL REFERENCES profiles(id),
  
  -- Tracking
  sent_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  
  -- Link to messaging log
  last_message_id UUID REFERENCES admin_messaging_log(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT beta_invitations_email_unique UNIQUE (email)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_admin_messaging_log_admin ON admin_messaging_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messaging_log_recipient ON admin_messaging_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_admin_messaging_log_template ON admin_messaging_log(template_name);
CREATE INDEX IF NOT EXISTS idx_admin_messaging_log_status ON admin_messaging_log(send_status);
CREATE INDEX IF NOT EXISTS idx_admin_messaging_log_created ON admin_messaging_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_invitations_email ON beta_invitations(email);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_status ON beta_invitations(status);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_token ON beta_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_invited_by ON beta_invitations(invited_by);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE admin_messaging_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_invitations ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for Edge Function operations)
CREATE POLICY "service_role_full_access_admin_messaging_log"
  ON admin_messaging_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_full_access_beta_invitations"
  ON beta_invitations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view all messaging logs
CREATE POLICY "admins_can_view_messaging_log"
  ON admin_messaging_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert messaging logs
CREATE POLICY "admins_can_insert_messaging_log"
  ON admin_messaging_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can view and manage beta invitations
CREATE POLICY "admins_can_view_beta_invitations"
  ON beta_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "admins_can_manage_beta_invitations"
  ON beta_invitations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to log a message send
CREATE OR REPLACE FUNCTION log_admin_message(
  p_admin_user_id UUID,
  p_recipient_email TEXT,
  p_recipient_name TEXT,
  p_recipient_company TEXT,
  p_template_name TEXT,
  p_message_type TEXT,
  p_send_status TEXT DEFAULT 'pending',
  p_sendgrid_message_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_messaging_log (
    admin_user_id,
    recipient_email,
    recipient_name,
    recipient_company,
    template_name,
    message_type,
    send_status,
    sendgrid_message_id,
    error_message,
    context,
    sent_at
  ) VALUES (
    p_admin_user_id,
    p_recipient_email,
    p_recipient_name,
    p_recipient_company,
    p_template_name,
    p_message_type,
    p_send_status,
    p_sendgrid_message_id,
    p_error_message,
    p_context,
    CASE WHEN p_send_status = 'sent' THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Function to update message status
CREATE OR REPLACE FUNCTION update_message_status(
  p_log_id UUID,
  p_send_status TEXT,
  p_sendgrid_message_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE admin_messaging_log
  SET 
    send_status = p_send_status,
    sendgrid_message_id = COALESCE(p_sendgrid_message_id, sendgrid_message_id),
    error_message = p_error_message,
    sent_at = CASE WHEN p_send_status = 'sent' THEN NOW() ELSE sent_at END
  WHERE id = p_log_id;
  
  RETURN FOUND;
END;
$$;

-- =============================================================================
-- STATS VIEW
-- =============================================================================

CREATE OR REPLACE VIEW admin_messaging_stats AS
SELECT
  COUNT(*) FILTER (WHERE send_status = 'sent') AS total_sent,
  COUNT(*) FILTER (WHERE send_status = 'failed') AS total_failed,
  COUNT(*) FILTER (WHERE send_status = 'pending') AS total_pending,
  COUNT(*) FILTER (WHERE message_type = 'beta_invite') AS beta_invites_sent,
  COUNT(*) FILTER (WHERE message_type = 'beta_reminder') AS beta_reminders_sent,
  COUNT(*) FILTER (WHERE message_type = 'reengagement') AS reengagement_sent,
  COUNT(*) AS total_messages,
  MAX(created_at) AS last_message_at
FROM admin_messaging_log;

CREATE OR REPLACE VIEW beta_invitation_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_count,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_count,
  COUNT(*) FILTER (WHERE status = 'revoked') AS revoked_count,
  COUNT(*) AS total_invitations
FROM beta_invitations;

-- Grant access to stats views for admins
GRANT SELECT ON admin_messaging_stats TO authenticated;
GRANT SELECT ON beta_invitation_stats TO authenticated;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update updated_at timestamp on beta_invitations changes
CREATE OR REPLACE FUNCTION update_beta_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_beta_invitations_updated_at
  BEFORE UPDATE ON beta_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_beta_invitations_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE admin_messaging_log IS 'Audit log for all admin-initiated messages (invitations, reminders, follow-ups)';
COMMENT ON TABLE beta_invitations IS 'Tracks outbound beta invitations sent by admins';
COMMENT ON COLUMN admin_messaging_log.template_name IS 'SendGrid template name used for the message';
COMMENT ON COLUMN admin_messaging_log.message_type IS 'Type of message: beta_invite, beta_reminder, beta_followup, reengagement, checkin';
COMMENT ON COLUMN beta_invitations.invitation_token IS 'Secure token for invitation acceptance';
COMMENT ON FUNCTION log_admin_message IS 'Logs an admin-initiated message send';
COMMENT ON FUNCTION update_message_status IS 'Updates the status of a logged message';
