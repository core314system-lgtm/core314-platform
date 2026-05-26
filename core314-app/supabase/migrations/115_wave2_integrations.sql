-- ============================================================
-- Wave 2 Integration Enablement: Zendesk, Asana, Jira, Notion, Trello
-- Enables API-key based integrations for read-only observational intelligence
-- ============================================================

-- 1. Enable Zendesk (Support category)
-- Already seeded in migration 105, just needs to be enabled
UPDATE public.integration_registry
SET 
  is_enabled = true,
  updated_at = NOW()
WHERE service_name = 'zendesk';

-- 2. Enable Asana (Project Management category)
-- Already seeded in migration 105, just needs to be enabled
UPDATE public.integration_registry
SET 
  is_enabled = true,
  updated_at = NOW()
WHERE service_name = 'asana';

-- 3. Enable Jira (Project Management category)
-- Already seeded in migration 105, just needs to be enabled
UPDATE public.integration_registry
SET 
  is_enabled = true,
  updated_at = NOW()
WHERE service_name = 'jira';

-- 4. Enable Notion (Productivity category)
-- Already seeded in migration 083, just needs to be enabled
UPDATE public.integration_registry
SET 
  is_enabled = true,
  category = 'productivity',
  updated_at = NOW()
WHERE service_name = 'notion';

-- 5. Enable Trello (Productivity category)
-- Already seeded in migration 083, just needs to be enabled
UPDATE public.integration_registry
SET 
  is_enabled = true,
  category = 'productivity',
  updated_at = NOW()
WHERE service_name = 'trello';

-- 6. Add entries to integrations_master for legacy FK support
INSERT INTO public.integrations_master (integration_name, integration_type, logo_url, is_core_integration, description)
VALUES 
  ('Zendesk', 'zendesk', 'https://cdn.worldvectorlogo.com/logos/zendesk-1.svg', true, 'Customer service and support platform'),
  ('Asana', 'asana', 'https://cdn.worldvectorlogo.com/logos/asana-logo.svg', true, 'Work management platform for teams'),
  ('Jira', 'jira', 'https://cdn.worldvectorlogo.com/logos/jira-1.svg', true, 'Issue tracking and project management'),
  ('Notion', 'notion', 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png', true, 'All-in-one workspace for notes and collaboration'),
  ('Trello', 'trello', 'https://cdn.worldvectorlogo.com/logos/trello.svg', true, 'Project management and task tracking')
ON CONFLICT (integration_name) DO NOTHING;

-- 7. Verify Wave 0 + Wave 1 + Wave 2 integrations are enabled
-- Expected: slack, microsoft_teams, zoom, google_calendar, zendesk, asana, jira, notion, trello (9 total)
DO $$
DECLARE
  enabled_count INTEGER;
  enabled_list TEXT;
BEGIN
  SELECT COUNT(*), string_agg(service_name, ', ' ORDER BY service_name) 
  INTO enabled_count, enabled_list
  FROM public.integration_registry 
  WHERE is_enabled = true;
  
  RAISE NOTICE 'Enabled integrations (count: %): %', enabled_count, enabled_list;
  
  IF enabled_count != 9 THEN
    RAISE WARNING 'Expected 9 integrations enabled. Found: %. List: %', enabled_count, enabled_list;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.integration_registry IS 'Wave 2 enabled: Slack, Microsoft Teams, Zoom, Google Calendar, Zendesk, Asana, Jira, Notion, Trello. CRM and billing integrations remain disabled for beta.';
