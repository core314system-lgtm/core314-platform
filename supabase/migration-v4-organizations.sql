-- ============================================================
-- Migration V4: Multi-Tenant Organization System
-- Organizations, memberships, and org-scoped data
-- ============================================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- 2. Organization members table
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- 3. Add org_id to user_profiles for current org context
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_org_id UUID REFERENCES organizations(id);

-- 4. Add org_id to task_orders
ALTER TABLE task_orders ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- 5. Add org_id to subcontractors
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- 6. Add project_type to task_orders (in case Phase 1 column wasn't added)
ALTER TABLE task_orders ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'government_task_order';

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_task_orders_org ON task_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_org ON subcontractors(org_id);

-- 8. RLS Policies for organizations
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Org owners/admins can update their organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 9. RLS Policies for organization_members
CREATE POLICY "Users can view members of their orgs"
  ON organization_members FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM organization_members AS om WHERE om.user_id = auth.uid())
  );

CREATE POLICY "Org owners/admins can manage members"
  ON organization_members FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners/admins can update members"
  ON organization_members FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org owners/admins can remove members"
  ON organization_members FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()  -- Users can remove themselves
  );

-- 10. Auto-create organization on first user signup
-- (This function creates a personal org if the user doesn't have one)
CREATE OR REPLACE FUNCTION public.ensure_user_org()
RETURNS trigger AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Check if user already has an organization
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id = NEW.id) THEN
    -- Create a default organization
    INSERT INTO organizations (name, slug)
    VALUES (
      COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)) || '''s Organization',
      'org-' || substr(gen_random_uuid()::text, 1, 8)
    )
    RETURNING id INTO new_org_id;

    -- Add user as owner
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');

    -- Set as current org
    UPDATE user_profiles SET current_org_id = new_org_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_profiles (fires after profile creation)
DROP TRIGGER IF EXISTS on_profile_created_ensure_org ON user_profiles;
CREATE TRIGGER on_profile_created_ensure_org
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_org();

-- 11. Bootstrap: Create org for existing users who don't have one
DO $$
DECLARE
  u RECORD;
  new_org_id UUID;
BEGIN
  FOR u IN
    SELECT up.id, up.email, up.full_name
    FROM user_profiles up
    WHERE NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = up.id)
  LOOP
    INSERT INTO organizations (name, slug)
    VALUES (
      COALESCE(u.full_name, split_part(u.email, '@', 1)) || '''s Organization',
      'org-' || substr(gen_random_uuid()::text, 1, 8)
    )
    RETURNING id INTO new_org_id;

    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (new_org_id, u.id, 'owner');

    UPDATE user_profiles SET current_org_id = new_org_id WHERE id = u.id;

    -- Assign existing data to this org
    UPDATE task_orders SET org_id = new_org_id WHERE created_by = u.id AND org_id IS NULL;
    UPDATE subcontractors SET org_id = new_org_id WHERE org_id IS NULL;
  END LOOP;
END;
$$;
