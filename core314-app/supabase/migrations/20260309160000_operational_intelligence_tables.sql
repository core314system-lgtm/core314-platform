-- Phase 1: Operational Intelligence Tables
-- Creates tables for signal detection, health scoring, and operational briefs

-- 1. operational_signals - Detected business signals from integration data
CREATE TABLE IF NOT EXISTS operational_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence NUMERIC(5,2) DEFAULT 0.0,
  description TEXT NOT NULL,
  source_integration TEXT NOT NULL,
  source_event_ids UUID[] DEFAULT '{}',
  signal_data JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. operational_health_scores - Composite operational health score history
CREATE TABLE IF NOT EXISTS operational_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  label TEXT NOT NULL CHECK (label IN ('Healthy', 'Moderate', 'At Risk', 'Critical')),
  signal_count INTEGER DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  integration_coverage JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. operational_briefs - AI-generated operational narratives
CREATE TABLE IF NOT EXISTS operational_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  title TEXT NOT NULL DEFAULT 'Operations Summary',
  detected_signals JSONB DEFAULT '[]',
  business_impact TEXT,
  recommended_actions JSONB DEFAULT '[]',
  risk_assessment TEXT,
  summary TEXT,
  confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  health_score INTEGER,
  signal_ids UUID[] DEFAULT '{}',
  brief_type TEXT DEFAULT 'operational',
  data_context JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for operational_signals
CREATE INDEX IF NOT EXISTS idx_operational_signals_user_id ON operational_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_operational_signals_org_id ON operational_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_operational_signals_active ON operational_signals(is_active, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_signals_type ON operational_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_operational_signals_severity ON operational_signals(severity);

-- Indexes for operational_health_scores
CREATE INDEX IF NOT EXISTS idx_health_scores_user_id ON operational_health_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_org_id ON operational_health_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_calculated ON operational_health_scores(calculated_at DESC);

-- Indexes for operational_briefs
CREATE INDEX IF NOT EXISTS idx_operational_briefs_user_id ON operational_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_operational_briefs_org_id ON operational_briefs(organization_id);
CREATE INDEX IF NOT EXISTS idx_operational_briefs_generated ON operational_briefs(generated_at DESC);

-- Row Level Security
ALTER TABLE operational_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_briefs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for operational_signals
CREATE POLICY "Users can view own signals"
  ON operational_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert signals"
  ON operational_signals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update signals"
  ON operational_signals FOR UPDATE
  USING (true);

-- RLS Policies for operational_health_scores
CREATE POLICY "Users can view own health scores"
  ON operational_health_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert health scores"
  ON operational_health_scores FOR INSERT
  WITH CHECK (true);

-- RLS Policies for operational_briefs
CREATE POLICY "Users can view own briefs"
  ON operational_briefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert briefs"
  ON operational_briefs FOR INSERT
  WITH CHECK (true);

-- Add HubSpot to integration registry if not exists
INSERT INTO integration_registry (service_name, display_name, description, auth_type, connection_type, is_enabled, oauth_authorize_url, oauth_token_url, oauth_scopes, icon_url)
VALUES (
  'hubspot',
  'HubSpot',
  'CRM platform for sales pipeline, deals, contacts, and revenue tracking',
  'oauth2',
  'oauth2',
  true,
  'https://app.hubspot.com/oauth/authorize',
  'https://api.hubapi.com/oauth/v1/token',
  ARRAY['crm.objects.deals.read', 'crm.objects.contacts.read', 'crm.objects.companies.read', 'crm.schemas.deals.read'],
  'https://www.hubspot.com/favicon.ico'
)
ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_enabled = EXCLUDED.is_enabled,
  oauth_authorize_url = EXCLUDED.oauth_authorize_url,
  oauth_token_url = EXCLUDED.oauth_token_url,
  oauth_scopes = EXCLUDED.oauth_scopes;
