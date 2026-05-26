
CREATE TABLE IF NOT EXISTS ai_support_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('support', 'onboarding')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  log_id UUID REFERENCES ai_support_logs(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL CHECK (feedback IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_onboarding_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  current_step INT DEFAULT 1,
  total_steps INT DEFAULT 4,
  step_1_completed BOOLEAN DEFAULT FALSE,
  step_2_completed BOOLEAN DEFAULT FALSE,
  step_3_completed BOOLEAN DEFAULT FALSE,
  step_4_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'onboarding_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_status TEXT DEFAULT 'not_started' 
      CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_support_logs_user_id ON ai_support_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_support_logs_org_id ON ai_support_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_support_logs_mode ON ai_support_logs(mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_log_id ON ai_feedback(log_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_id ON support_tickets(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_org_id ON user_onboarding_progress(organization_id);

ALTER TABLE ai_support_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ai_support_logs"
  ON ai_support_logs FOR SELECT
  USING (
    auth.uid() = user_id
    OR 
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can insert their own ai_support_logs"
  ON ai_support_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to ai_support_logs"
  ON ai_support_logs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view their own ai_feedback"
  ON ai_feedback FOR SELECT
  USING (
    auth.uid() = user_id
    OR 
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can insert their own ai_feedback"
  ON ai_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to ai_feedback"
  ON ai_feedback FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view their own support_tickets"
  ON support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all support_tickets in their org"
  ON support_tickets FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can insert their own support_tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update support_tickets in their org"
  ON support_tickets FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role has full access to support_tickets"
  ON support_tickets FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view their own user_onboarding_progress"
  ON user_onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own user_onboarding_progress"
  ON user_onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own user_onboarding_progress"
  ON user_onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to user_onboarding_progress"
  ON user_onboarding_progress FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

GRANT SELECT, INSERT ON ai_support_logs TO authenticated;
GRANT SELECT, INSERT ON ai_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON support_tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_onboarding_progress TO authenticated;

GRANT ALL ON ai_support_logs TO service_role;
GRANT ALL ON ai_feedback TO service_role;
GRANT ALL ON support_tickets TO service_role;
GRANT ALL ON user_onboarding_progress TO service_role;

ALTER TABLE fusion_audit_log DROP CONSTRAINT IF EXISTS fusion_audit_log_event_type_check;
ALTER TABLE fusion_audit_log ADD CONSTRAINT fusion_audit_log_event_type_check 
  CHECK (event_type IN (
    'manual_recalibration', 'scheduled_recalibration', 'adaptive_trigger', 
    'simulation_run', 'simulation_viewed', 'simulation_deleted',
    'optimization_analyzed', 'optimization_applied', 'optimization_dismissed',
    'global_insight_aggregated', 'insight_viewed', 'recommendation_generated',
    'governance_policy_created', 'governance_policy_updated', 'governance_policy_deleted',
    'governance_auto_review_completed', 'governance_summary_generated',
    'email_sent', 'email_failed', 'email_bounced',
    'ai_support_query', 'ai_support_escalation', 'ai_feedback_submitted',
    'onboarding_step_completed', 'onboarding_completed'
  ));
