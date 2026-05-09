-- Phase 2: Ontology Abstraction Layer
-- Declarative mapping system so new integrations are configured, not coded.

-- ── Entity Type Definitions ─────────────────────────────────────────────
-- Defines the canonical entity types in the system (person, company, deal, project, etc.)
CREATE TABLE IF NOT EXISTS entity_type_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Box',
  color TEXT DEFAULT '#6B7280',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE entity_type_definitions IS 'Defines canonical entity types (person, company, deal, etc.) with their field schemas';
COMMENT ON COLUMN entity_type_definitions.fields IS 'JSON array of { name, type, required, description } field definitions';

-- ── Integration Field Mappings ──────────────────────────────────────────
-- Declarative rules that map integration API fields to entity fields.
-- When a new integration is added, you create mappings here instead of editing code.
CREATE TABLE IF NOT EXISTS integration_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_service_name TEXT NOT NULL,
  source_event_type TEXT,
  source_field_path TEXT NOT NULL,
  target_entity_type TEXT NOT NULL REFERENCES entity_type_definitions(name) ON DELETE CASCADE,
  target_field TEXT NOT NULL,
  transform_rule TEXT,
  hint_type TEXT NOT NULL DEFAULT 'person' CHECK (hint_type IN ('person', 'company')),
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_service_name, source_field_path, target_entity_type, target_field)
);

COMMENT ON TABLE integration_field_mappings IS 'Declarative rules mapping integration API fields to entity type fields';
COMMENT ON COLUMN integration_field_mappings.source_field_path IS 'Dot-notation path in event metadata, e.g. portal_name or contacts[].email';
COMMENT ON COLUMN integration_field_mappings.transform_rule IS 'Optional transform: split_email_domain, normalize_phone, title_case, etc.';

-- ── Mapping Overrides ───────────────────────────────────────────────────
-- Admin overrides for specific mappings per-user or globally.
CREATE TABLE IF NOT EXISTS mapping_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_mapping_id UUID NOT NULL REFERENCES integration_field_mappings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('disable', 'remap', 'custom_transform')),
  override_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_mapping_id, user_id)
);

COMMENT ON TABLE mapping_overrides IS 'Admin overrides to disable, remap, or transform specific field mappings';
COMMENT ON COLUMN mapping_overrides.user_id IS 'NULL = global override, non-null = user-specific override';

-- ── Ontology Processing Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ontology_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_event_id UUID,
  integration_service_name TEXT NOT NULL,
  mappings_applied INTEGER NOT NULL DEFAULT 0,
  entities_extracted INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_field_mappings_service
  ON integration_field_mappings(integration_service_name);
CREATE INDEX IF NOT EXISTS idx_field_mappings_target
  ON integration_field_mappings(target_entity_type);
CREATE INDEX IF NOT EXISTS idx_field_mappings_active
  ON integration_field_mappings(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mapping_overrides_mapping
  ON mapping_overrides(field_mapping_id);
CREATE INDEX IF NOT EXISTS idx_mapping_overrides_user
  ON mapping_overrides(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ontology_log_user
  ON ontology_processing_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ontology_log_service
  ON ontology_processing_log(integration_service_name, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE entity_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology_processing_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; these policies allow admin reads
CREATE POLICY "Admins can read entity type definitions"
  ON entity_type_definitions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage entity type definitions"
  ON entity_type_definitions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE POLICY "Admins can read field mappings"
  ON integration_field_mappings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage field mappings"
  ON integration_field_mappings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE POLICY "Admins can read mapping overrides"
  ON mapping_overrides FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE POLICY "Admins can manage mapping overrides"
  ON mapping_overrides FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE POLICY "Users can read own ontology logs"
  ON ontology_processing_log FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- ── Seed Built-in Entity Types ──────────────────────────────────────────
INSERT INTO entity_type_definitions (name, display_name, description, icon, color, fields, is_builtin) VALUES
  ('person', 'Person', 'An individual contact, employee, or collaborator', 'User', '#3B82F6',
   '[{"name":"name","type":"text","required":true,"description":"Full name"},{"name":"email","type":"email","required":false,"description":"Email address"},{"name":"phone","type":"phone","required":false,"description":"Phone number"},{"name":"title","type":"text","required":false,"description":"Job title"},{"name":"company","type":"text","required":false,"description":"Associated company name"}]'::jsonb,
   true),
  ('company', 'Company', 'A business organization or account', 'Building2', '#8B5CF6',
   '[{"name":"name","type":"text","required":true,"description":"Company name"},{"name":"domain","type":"text","required":false,"description":"Primary web domain"},{"name":"industry","type":"text","required":false,"description":"Industry sector"},{"name":"size","type":"text","required":false,"description":"Company size range"}]'::jsonb,
   true),
  ('deal', 'Deal', 'A sales opportunity or transaction', 'DollarSign', '#10B981',
   '[{"name":"name","type":"text","required":true,"description":"Deal name"},{"name":"value","type":"number","required":false,"description":"Deal value"},{"name":"stage","type":"text","required":false,"description":"Pipeline stage"},{"name":"close_date","type":"date","required":false,"description":"Expected close date"}]'::jsonb,
   true),
  ('project', 'Project', 'A work project or initiative', 'FolderKanban', '#F59E0B',
   '[{"name":"name","type":"text","required":true,"description":"Project name"},{"name":"status","type":"text","required":false,"description":"Current status"},{"name":"owner","type":"text","required":false,"description":"Project owner"},{"name":"due_date","type":"date","required":false,"description":"Due date"}]'::jsonb,
   true),
  ('ticket', 'Ticket', 'A support ticket or issue', 'Ticket', '#EF4444',
   '[{"name":"name","type":"text","required":true,"description":"Ticket subject"},{"name":"status","type":"text","required":false,"description":"Ticket status"},{"name":"priority","type":"text","required":false,"description":"Priority level"},{"name":"assignee","type":"text","required":false,"description":"Assigned person"}]'::jsonb,
   true)
ON CONFLICT (name) DO NOTHING;

-- ── Seed Default Field Mappings ─────────────────────────────────────────
-- These map common integration fields to entity types automatically.
-- New integrations just need rows added here — no code changes needed.
INSERT INTO integration_field_mappings
  (integration_service_name, source_event_type, source_field_path, target_entity_type, target_field, hint_type, priority, description)
VALUES
  -- HubSpot
  ('hubspot', NULL, 'portal_name', 'company', 'name', 'company', 100, 'HubSpot portal name → company'),
  ('hubspot', NULL, 'stalled_deal_names[]', 'deal', 'name', 'company', 90, 'Stalled deals → deal names'),
  ('hubspot', NULL, 'portal_id', 'company', 'external_id', 'company', 100, 'HubSpot portal ID'),
  -- Salesforce
  ('salesforce', NULL, 'opportunity_summary[].name', 'deal', 'name', 'company', 100, 'Salesforce opportunity → deal'),
  -- Jira
  ('jira', NULL, 'assignee_counts', 'person', 'name', 'person', 100, 'Jira assignees → people'),
  ('jira', NULL, 'project_name', 'project', 'name', 'company', 90, 'Jira project → project entity'),
  -- Slack
  ('slack', NULL, 'team_name', 'company', 'name', 'company', 100, 'Slack workspace → company'),
  -- GitHub
  ('github', NULL, 'username', 'person', 'name', 'person', 100, 'GitHub username → person'),
  ('github', NULL, 'username', 'person', 'external_id', 'person', 100, 'GitHub username as external ID'),
  -- Zendesk
  ('zendesk', NULL, 'subdomain', 'company', 'name', 'company', 100, 'Zendesk subdomain → company'),
  -- Asana
  ('asana', NULL, 'workspaces[].name', 'company', 'name', 'company', 100, 'Asana workspace → company'),
  -- Monday
  ('monday', NULL, 'users[].name', 'person', 'name', 'person', 100, 'Monday users → people'),
  ('monday', NULL, 'users[].email', 'person', 'email', 'person', 100, 'Monday user emails'),
  -- Teams
  ('microsoft_teams', NULL, 'user_display_name', 'person', 'name', 'person', 100, 'Teams display name → person'),
  -- Gmail
  ('gmail', NULL, 'email_address', 'person', 'email', 'person', 100, 'Gmail address → person email'),
  -- Google Calendar
  ('google_calendar', NULL, 'attendees[].email', 'person', 'email', 'person', 100, 'Calendar attendees → people'),
  ('google_calendar', NULL, 'attendees[].displayName', 'person', 'name', 'person', 90, 'Calendar attendee names'),
  -- QuickBooks
  ('quickbooks', NULL, 'company_name', 'company', 'name', 'company', 100, 'QuickBooks company → company'),
  -- Zoom
  ('zoom', NULL, 'user_name', 'person', 'name', 'person', 100, 'Zoom user → person')
ON CONFLICT (integration_service_name, source_field_path, target_entity_type, target_field) DO NOTHING;

-- ── Update resolved_entities to support new entity types ────────────────
-- Relax the entity_type constraint to allow custom types
ALTER TABLE resolved_entities
  DROP CONSTRAINT IF EXISTS resolved_entities_entity_type_check;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resolved_entities' AND column_name = 'entity_type') THEN
    ALTER TABLE resolved_entities
      ADD CONSTRAINT resolved_entities_entity_type_check
      CHECK (entity_type IN (SELECT name FROM entity_type_definitions));
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add entity_type check constraint: %', SQLERRM;
END $$;
