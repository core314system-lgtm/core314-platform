-- HubSpot OAuth Integration Migration
-- Creates hubspot_connections table and updates integration_registry for OAuth2

-- 1. Create hubspot_connections table for HubSpot portal-specific data
CREATE TABLE IF NOT EXISTS hubspot_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_integration_id UUID REFERENCES user_integrations(id) ON DELETE SET NULL,
  hubspot_portal_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,
  contacts_synced INTEGER DEFAULT 0,
  deals_synced INTEGER DEFAULT 0,
  companies_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by user
CREATE INDEX IF NOT EXISTS idx_hubspot_connections_user_id ON hubspot_connections(user_id);

-- Enable RLS
ALTER TABLE hubspot_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own hubspot connections"
  ON hubspot_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage hubspot connections"
  ON hubspot_connections FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Update integration_registry: change HubSpot from api_key to oauth2
UPDATE integration_registry
SET
  auth_type = 'oauth2',
  connection_type = 'oauth2',
  provider_type = 'oauth2',
  oauth_authorize_url = 'https://app.hubspot.com/oauth/authorize',
  oauth_token_url = 'https://api.hubapi.com/oauth/v1/token',
  oauth_scopes = ARRAY['crm.objects.contacts.read', 'crm.objects.deals.read', 'crm.objects.companies.read'],
  oauth_required = true,
  credential_entry_mode = 'oauth',
  required_fields = '[]'::jsonb,
  updated_at = NOW()
WHERE service_name = 'hubspot';
