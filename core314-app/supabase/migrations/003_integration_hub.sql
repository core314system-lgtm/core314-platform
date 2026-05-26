
CREATE TABLE IF NOT EXISTS integrations_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name TEXT NOT NULL UNIQUE,
  integration_type TEXT NOT NULL,
  logo_url TEXT,
  is_core_integration BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations_master(id) ON DELETE CASCADE,
  added_by_user BOOLEAN DEFAULT false,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  config JSONB,
  UNIQUE(user_id, integration_id)
);

INSERT INTO integrations_master (integration_name, integration_type, logo_url, is_core_integration, description) VALUES
  ('Slack', 'slack', 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg', true, 'Team communication and collaboration'),
  ('Microsoft Teams', 'microsoft_teams', 'https://cdn.worldvectorlogo.com/logos/microsoft-teams-1.svg', true, 'Enterprise collaboration platform'),
  ('Microsoft 365', 'microsoft_365', 'https://cdn.worldvectorlogo.com/logos/microsoft-5.svg', true, 'Calendar, OneDrive, and SharePoint management'),
  ('Outlook', 'outlook', 'https://cdn.worldvectorlogo.com/logos/microsoft-outlook-2019.svg', true, 'Email management'),
  ('Gmail', 'gmail', 'https://cdn.worldvectorlogo.com/logos/gmail-icon.svg', true, 'Google email and workspace'),
  ('Trello', 'trello', 'https://cdn.worldvectorlogo.com/logos/trello.svg', true, 'Project management and task tracking'),
  ('SendGrid', 'sendgrid', 'https://cdn.worldvectorlogo.com/logos/sendgrid-1.svg', true, 'Email delivery and notifications')
ON CONFLICT (integration_name) DO NOTHING;

ALTER TABLE integrations_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view integrations" ON integrations_master
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage integrations" ON integrations_master
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can add own integrations" ON user_integrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own integrations" ON user_integrations
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_integrations_master_type ON integrations_master(integration_type);
CREATE INDEX idx_integrations_master_core ON integrations_master(is_core_integration);
CREATE INDEX idx_user_integrations_user ON user_integrations(user_id);
CREATE INDEX idx_user_integrations_status ON user_integrations(user_id, status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_integrations_master_updated_at BEFORE UPDATE ON integrations_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
