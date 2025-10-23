-- ============================================================
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'automation_hooks' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.automation_hooks 
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'automation_hooks' 
    AND column_name = 'integration_id'
  ) THEN
    ALTER TABLE public.automation_hooks 
    ADD COLUMN integration_id UUID REFERENCES public.integrations_master(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.automation_hooks DROP CONSTRAINT IF EXISTS automation_hooks_trigger_source_check;

ALTER TABLE public.automation_hooks 
  ALTER COLUMN trigger_source DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_hooks_user_id ON public.automation_hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_hooks_integration_id ON public.automation_hooks(integration_id);

DROP POLICY IF EXISTS "Users can view own automation hooks" ON public.automation_hooks;
CREATE POLICY "Users can view own automation hooks"
ON public.automation_hooks FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own automation hooks" ON public.automation_hooks;
CREATE POLICY "Users can insert own automation hooks"
ON public.automation_hooks FOR INSERT
WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN public.automation_hooks.user_id IS 'User who owns this automation hook';
COMMENT ON COLUMN public.automation_hooks.integration_id IS 'Integration this hook is associated with';
