-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  condition JSONB,
  action JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON public.automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_status ON public.automation_rules(status);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON public.automation_rules(trigger_type);

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_org ON public.automation_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON public.automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON public.automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON public.automation_logs(created_at DESC);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rules in their organizations"
ON public.automation_rules FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org admins can create rules"
ON public.automation_rules FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Org admins can update rules"
ON public.automation_rules FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Org admins can delete rules"
ON public.automation_rules FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Users can view logs in their organizations"
ON public.automation_logs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert logs"
ON public.automation_logs FOR INSERT
TO service_role
WITH CHECK (true);

GRANT ALL ON public.automation_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_logs TO service_role;
GRANT SELECT ON public.automation_logs TO authenticated;

CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.automation_rules IS 'Automation rules for triggering actions based on system events';
COMMENT ON TABLE public.automation_logs IS 'Log of automation rule executions';
