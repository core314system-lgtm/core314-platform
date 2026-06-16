-- Comprehensive audit logging for security compliance
-- Tracks user actions: logins, data access, exports, permission changes, settings changes

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_id ON audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id);

-- RLS: Only admins can view audit logs for their org
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can view all audit events"
  ON audit_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_global_admin = true)
  );

CREATE POLICY "Org admins can view their org audit events"
  ON audit_events FOR SELECT
  USING (
    org_id IN (
      SELECT current_org_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow authenticated users to insert (for client-side logging)
CREATE POLICY "Authenticated users can insert audit events"
  ON audit_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
