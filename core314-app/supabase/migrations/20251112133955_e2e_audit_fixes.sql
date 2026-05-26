-- E2E Audit Fixes Migration
-- Generated: 2025-11-12
-- Purpose: Fix all critical issues found during comprehensive E2E audit

-- ISSUE 1: Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_token)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON public.user_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
  ON public.user_sessions
  FOR SELECT
  USING (is_platform_admin());

-- ISSUE 2: Add profiles.last_login column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON public.profiles(last_login);

-- ISSUE 5: Create integration_registry table
CREATE TABLE IF NOT EXISTS public.integration_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom' CHECK (category IN ('core', 'custom', 'enterprise')),
  icon_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  requires_oauth BOOLEAN NOT NULL DEFAULT false,
  oauth_provider TEXT,
  config_schema JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_integration_registry_name ON public.integration_registry(name);
CREATE INDEX IF NOT EXISTS idx_integration_registry_is_enabled ON public.integration_registry(is_enabled);
CREATE INDEX IF NOT EXISTS idx_integration_registry_category ON public.integration_registry(category);

-- Enable RLS
ALTER TABLE public.integration_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integration_registry (public read, admin write)
CREATE POLICY "Anyone can view enabled integrations"
  ON public.integration_registry
  FOR SELECT
  USING (is_enabled = true);

CREATE POLICY "Admins can manage integrations"
  ON public.integration_registry
  FOR ALL
  USING (is_platform_admin());

-- Insert default integrations
INSERT INTO public.integration_registry (name, display_name, description, category, is_enabled, requires_oauth, oauth_provider)
VALUES
  ('slack', 'Slack', 'Team communication and collaboration', 'core', true, true, 'slack'),
  ('microsoft-teams', 'Microsoft Teams', 'Enterprise collaboration platform', 'core', true, true, 'microsoft'),
  ('microsoft-365', 'Microsoft 365', 'Calendar, OneDrive, and SharePoint management', 'core', true, true, 'microsoft'),
  ('outlook', 'Outlook', 'Email management', 'core', true, true, 'microsoft'),
  ('gmail', 'Gmail', 'Google email and workspace', 'core', true, true, 'google'),
  ('trello', 'Trello', 'Project management and task tracking', 'core', true, true, 'trello'),
  ('sendgrid', 'SendGrid', 'Email delivery and notifications', 'core', true, false, null),
  ('asana', 'Asana', 'Project and task management platform', 'custom', true, true, 'asana'),
  ('jira', 'Jira', 'Issue tracking and project management', 'custom', true, true, 'atlassian')
ON CONFLICT (name) DO NOTHING;

-- ISSUE 3 & 4: Fix RLS policies for fusion_action_log and fusion_visual_cache
-- Drop existing restrictive policies and create more permissive ones

-- Fix fusion_action_log policies
DROP POLICY IF EXISTS "Users can view their own action logs" ON public.fusion_action_log;
DROP POLICY IF EXISTS "Users can insert their own action logs" ON public.fusion_action_log;

CREATE POLICY "Users can view their own action logs"
  ON public.fusion_action_log
  FOR SELECT
  USING (auth.uid() = user_id OR is_platform_admin());

CREATE POLICY "Users can insert their own action logs"
  ON public.fusion_action_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all action logs"
  ON public.fusion_action_log
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Fix fusion_visual_cache policies
DROP POLICY IF EXISTS "Users can view their own visual cache" ON public.fusion_visual_cache;
DROP POLICY IF EXISTS "Users can manage their own visual cache" ON public.fusion_visual_cache;

CREATE POLICY "Users can view visual cache"
  ON public.fusion_visual_cache
  FOR SELECT
  USING (
    user_id IS NULL OR 
    auth.uid() = user_id OR 
    is_platform_admin()
  );

CREATE POLICY "Users can manage their own visual cache"
  ON public.fusion_visual_cache
  FOR ALL
  USING (auth.uid() = user_id OR is_platform_admin());

CREATE POLICY "Service role can manage all visual cache"
  ON public.fusion_visual_cache
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Add comment for tracking
COMMENT ON TABLE public.user_sessions IS 'E2E Audit Fix: Created to track user session activity';
COMMENT ON COLUMN public.profiles.last_login IS 'E2E Audit Fix: Added to track last login timestamp';
COMMENT ON TABLE public.integration_registry IS 'E2E Audit Fix: Created to manage available integrations';
