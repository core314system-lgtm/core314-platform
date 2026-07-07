-- Enterprise Readiness: Contacts, Project Comments, Project Tasks, Org Settings
-- Migration for all Tier 1 & Tier 2 features

-- =====================================================
-- 1. Contacts table (CRM/Contact Management)
-- =====================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  organization TEXT,
  contact_type TEXT NOT NULL DEFAULT 'other',
  agency TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'contacts_org_policy') THEN
    CREATE POLICY contacts_org_policy ON contacts FOR ALL TO authenticated
      USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
      WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(contact_type);

-- =====================================================
-- 2. Project Contacts junction table
-- =====================================================
CREATE TABLE IF NOT EXISTS project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES task_orders(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_contacts' AND policyname = 'project_contacts_org_policy') THEN
    CREATE POLICY project_contacts_org_policy ON project_contacts FOR ALL TO authenticated
      USING (project_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())))
      WITH CHECK (project_id IN (SELECT id FROM task_orders WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_contacts_project ON project_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contacts_contact ON project_contacts(contact_id);

-- =====================================================
-- 3. Project Comments table (Activity Feed)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES task_orders(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_comments' AND policyname = 'project_comments_org_policy') THEN
    CREATE POLICY project_comments_org_policy ON project_comments FOR ALL TO authenticated
      USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
      WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_org ON project_comments(org_id);

-- =====================================================
-- 4. Project Tasks table (Task Assignments)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES task_orders(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_tasks' AND policyname = 'project_tasks_org_policy') THEN
    CREATE POLICY project_tasks_org_policy ON project_tasks FOR ALL TO authenticated
      USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
      WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_org ON project_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);

-- =====================================================
-- 5. Organization Settings (Slack webhook + future config)
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  slack_webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_settings' AND policyname = 'org_settings_policy') THEN
    CREATE POLICY org_settings_policy ON organization_settings FOR ALL TO authenticated
      USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
      WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;
