-- Enterprise custom email domains
-- Allows each organization to configure their own sending domain and branding

CREATE TABLE IF NOT EXISTS org_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT 'Notifications',
  from_email TEXT NOT NULL,
  reply_to_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'verified', 'failed')),
  -- DNS verification records (populated after domain is added)
  spf_record TEXT,
  spf_verified BOOLEAN DEFAULT FALSE,
  dkim_selector TEXT,
  dkim_record TEXT,
  dkim_verified BOOLEAN DEFAULT FALSE,
  mx_record TEXT,
  mx_verified BOOLEAN DEFAULT FALSE,
  tracking_cname TEXT,
  tracking_verified BOOLEAN DEFAULT FALSE,
  -- Branding
  logo_url TEXT,
  brand_color TEXT DEFAULT '#4F46E5',
  footer_text TEXT,
  -- Mailgun/provider details
  mailgun_domain_id TEXT,
  provider TEXT NOT NULL DEFAULT 'mailgun' CHECK (provider IN ('mailgun', 'ses', 'sendgrid')),
  -- Metadata
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(org_id, domain)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_org_email_domains_org_id ON org_email_domains(org_id);
CREATE INDEX IF NOT EXISTS idx_org_email_domains_status ON org_email_domains(status);

-- Add email branding preferences to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email_branding_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_email_domain_id UUID REFERENCES org_email_domains(id);

-- RLS policies
ALTER TABLE org_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org email domains"
  ON org_email_domains FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage org email domains"
  ON org_email_domains FOR ALL
  USING (org_id IN (
    SELECT org_id FROM user_profiles WHERE id = auth.uid() AND role IN ('admin')
  ));
