-- ============================================================
-- Wave 3A Integration Enablement: 10 New Integrations
-- Rapid catalog expansion with API-key/token based auth
-- Read-only, Tier 0 observational intelligence only
-- ============================================================

-- 1. Add Intercom (Support category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('intercom', 'Intercom', 'api_key', 'support', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'support', updated_at = NOW();

-- 2. Add Freshdesk (Support category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('freshdesk', 'Freshdesk', 'api_key', 'support', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'support', updated_at = NOW();

-- 3. Add Linear (Project Management category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('linear', 'Linear', 'api_key', 'project_management', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'project_management', updated_at = NOW();

-- 4. Add Monday.com (Project Management category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('monday', 'Monday.com', 'api_key', 'project_management', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'project_management', updated_at = NOW();

-- 5. Add ClickUp (Project Management category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('clickup', 'ClickUp', 'api_key', 'project_management', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'project_management', updated_at = NOW();

-- 6. Add Basecamp (Project Management category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('basecamp', 'Basecamp', 'api_key', 'project_management', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'project_management', updated_at = NOW();

-- 7. Add GitHub (Engineering category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('github', 'GitHub', 'api_key', 'engineering', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'engineering', updated_at = NOW();

-- 8. Add GitLab (Engineering category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('gitlab', 'GitLab', 'api_key', 'engineering', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'engineering', updated_at = NOW();

-- 9. Add Bitbucket (Engineering category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('bitbucket', 'Bitbucket', 'api_key', 'engineering', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'engineering', updated_at = NOW();

-- 10. Add Confluence (Knowledge Base category)
INSERT INTO public.integration_registry (service_name, display_name, auth_type, category, is_enabled, created_at, updated_at)
VALUES ('confluence', 'Confluence', 'api_key', 'knowledge_base', true, NOW(), NOW())
ON CONFLICT (service_name) DO UPDATE SET is_enabled = true, category = 'knowledge_base', updated_at = NOW();

-- Add entries to integrations_master for legacy FK support
INSERT INTO public.integrations_master (integration_name, integration_type, logo_url, is_core_integration, description)
VALUES 
  ('Intercom', 'intercom', 'https://cdn.worldvectorlogo.com/logos/intercom-1.svg', true, 'Customer messaging platform'),
  ('Freshdesk', 'freshdesk', 'https://cdn.worldvectorlogo.com/logos/freshdesk.svg', true, 'Customer support software'),
  ('Linear', 'linear', 'https://cdn.worldvectorlogo.com/logos/linear-1.svg', true, 'Issue tracking for modern teams'),
  ('Monday.com', 'monday', 'https://cdn.worldvectorlogo.com/logos/monday-1.svg', true, 'Work operating system'),
  ('ClickUp', 'clickup', 'https://cdn.worldvectorlogo.com/logos/clickup-1.svg', true, 'All-in-one productivity platform'),
  ('Basecamp', 'basecamp', 'https://cdn.worldvectorlogo.com/logos/basecamp-1.svg', true, 'Project management and team communication'),
  ('GitHub', 'github', 'https://cdn.worldvectorlogo.com/logos/github-icon-1.svg', true, 'Code hosting and collaboration'),
  ('GitLab', 'gitlab', 'https://cdn.worldvectorlogo.com/logos/gitlab.svg', true, 'DevOps platform'),
  ('Bitbucket', 'bitbucket', 'https://cdn.worldvectorlogo.com/logos/bitbucket-icon.svg', true, 'Git code management'),
  ('Confluence', 'confluence', 'https://cdn.worldvectorlogo.com/logos/confluence-1.svg', true, 'Team workspace and documentation')
ON CONFLICT (integration_name) DO NOTHING;

-- Verify total enabled integrations
-- Expected: Wave 0 (2) + Wave 1 (2) + Wave 2 (5) + Wave 3A (10) = 19 total
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
  
  IF enabled_count < 19 THEN
    RAISE WARNING 'Expected at least 19 integrations enabled. Found: %. List: %', enabled_count, enabled_list;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.integration_registry IS 'Wave 3A enabled: Added Intercom, Freshdesk, Linear, Monday.com, ClickUp, Basecamp, GitHub, GitLab, Bitbucket, Confluence. Total: 19+ integrations.';
