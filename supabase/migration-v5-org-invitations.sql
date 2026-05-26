-- ============================================================
-- Migration V5: Organization Invitation System
-- Email-based invitations with token-based signup linking
-- ============================================================

CREATE TABLE IF NOT EXISTS org_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  UNIQUE(org_id, email, status)
);

ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON org_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON org_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON org_invitations(org_id);

-- RLS: Allow reading invitations (needed for signup page to look up invite by token)
CREATE POLICY "Anyone can view invitations"
  ON org_invitations FOR SELECT
  USING (true);

-- RLS: Org owners/admins can create invitations
CREATE POLICY "Org owners/admins can create invitations"
  ON org_invitations FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- RLS: Org owners/admins can update invitations (cancel)
CREATE POLICY "Org owners/admins can update invitations"
  ON org_invitations FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- RLS: Org owners/admins can delete invitations
CREATE POLICY "Org owners/admins can delete invitations"
  ON org_invitations FOR DELETE
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );
