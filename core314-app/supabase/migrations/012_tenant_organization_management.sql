-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'analyst', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'analyst', 'member')),
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);

ALTER TABLE public.fusion_weightings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.fusion_insights ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.fusion_audit_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.fusion_action_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fusion_weightings_org ON public.fusion_weightings(organization_id);
CREATE INDEX IF NOT EXISTS idx_fusion_insights_org ON public.fusion_insights(organization_id);
CREATE INDEX IF NOT EXISTS idx_fusion_audit_log_org ON public.fusion_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_fusion_action_log_org ON public.fusion_action_log(organization_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organizations they belong to"
ON public.organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update their organizations"
ON public.organizations FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Organization owners can delete their organizations"
ON public.organizations FOR DELETE
USING (owner_id = auth.uid());

CREATE POLICY "Users can view members of their organizations"
ON public.organization_members FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners/admins can manage members"
ON public.organization_members FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Organization members can view invitations"
ON public.organization_invitations FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners/admins can create invitations"
ON public.organization_invitations FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Users can view own weights" ON public.fusion_weightings;
CREATE POLICY "Users can view weights in their organizations"
ON public.fusion_weightings FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view own insights" ON public.fusion_insights;
CREATE POLICY "Users can view insights in their organizations"
ON public.fusion_insights FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.fusion_audit_log;
CREATE POLICY "Users can view audit logs in their organizations"
ON public.fusion_audit_log FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin can view action logs" ON public.fusion_action_log;
CREATE POLICY "Users can view action logs in their organizations"
ON public.fusion_action_log FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

GRANT ALL ON public.organizations TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
GRANT SELECT, INSERT, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;
GRANT SELECT, INSERT ON public.organization_invitations TO authenticated;

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
BEGIN
  FOR user_record IN SELECT id, email FROM auth.users
  LOOP
    INSERT INTO public.organizations (name, owner_id, plan, status)
    VALUES (
      'Personal - ' || COALESCE(user_record.email, 'User'),
      user_record.id,
      (SELECT COALESCE(subscription_tier, 'starter') FROM public.profiles WHERE id = user_record.id),
      'active'
    )
    RETURNING id INTO new_org_id;
    
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'owner');
    
    UPDATE public.fusion_weightings SET organization_id = new_org_id WHERE user_id = user_record.id AND organization_id IS NULL;
    UPDATE public.fusion_insights SET organization_id = new_org_id WHERE user_id = user_record.id AND organization_id IS NULL;
    UPDATE public.fusion_audit_log SET organization_id = new_org_id WHERE user_id = user_record.id AND organization_id IS NULL;
    UPDATE public.fusion_action_log SET organization_id = new_org_id 
    WHERE rule_id IN (SELECT id FROM public.fusion_automation_rules WHERE user_id = user_record.id) AND organization_id IS NULL;
  END LOOP;
END $$;

COMMENT ON TABLE public.organizations IS 'Organizations for multi-tenant support - each org has independent data isolation';
COMMENT ON TABLE public.organization_members IS 'Membership tracking - users can belong to multiple organizations';
COMMENT ON TABLE public.organization_invitations IS 'Pending invitations for users to join organizations';
