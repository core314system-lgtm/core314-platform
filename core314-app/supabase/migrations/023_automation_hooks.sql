-- ============================================================
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('slack', 'teams', 'quickbooks', 'system')),
  action JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  executed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_hooks_status ON public.automation_hooks(status);
CREATE INDEX IF NOT EXISTS idx_automation_hooks_trigger_source ON public.automation_hooks(trigger_source);
CREATE INDEX IF NOT EXISTS idx_automation_hooks_event_type ON public.automation_hooks(event_type);
CREATE INDEX IF NOT EXISTS idx_automation_hooks_created_at ON public.automation_hooks(created_at DESC);

ALTER TABLE public.automation_hooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all automation hooks" ON public.automation_hooks;
CREATE POLICY "Admins can view all automation hooks"
ON public.automation_hooks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Service role can manage automation hooks" ON public.automation_hooks;
CREATE POLICY "Service role can manage automation hooks"
ON public.automation_hooks FOR ALL
TO service_role
WITH CHECK (true);

GRANT ALL ON public.automation_hooks TO service_role;
GRANT SELECT ON public.automation_hooks TO authenticated;

COMMENT ON TABLE public.automation_hooks IS 'AI-driven automation hooks triggered by external events (Slack, Teams, QuickBooks)';
