
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS beta_status TEXT NOT NULL DEFAULT 'pending' 
CHECK (beta_status IN ('pending', 'approved', 'revoked'));

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS beta_approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_beta_status ON public.profiles(beta_status);

UPDATE public.profiles 
SET beta_status = 'approved', 
    beta_approved_at = NOW() 
WHERE role = 'admin' 
  AND beta_status <> 'approved';

COMMENT ON COLUMN public.profiles.beta_status IS 'Beta access status: pending (awaiting approval), approved (can access app), revoked (access removed)';
COMMENT ON COLUMN public.profiles.beta_approved_at IS 'Timestamp when beta access was approved';

CREATE POLICY IF NOT EXISTS "Users can read own beta status"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Admins can update beta status"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION log_beta_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.beta_status IS DISTINCT FROM NEW.beta_status THEN
    INSERT INTO public.beta_monitoring_log (
      user_id,
      event_type,
      old_status,
      new_status,
      changed_by,
      created_at
    ) VALUES (
      NEW.id,
      'beta_status_change',
      OLD.beta_status,
      NEW.beta_status,
      auth.uid(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_beta_status_change ON public.profiles;
CREATE TRIGGER trigger_log_beta_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.beta_status IS DISTINCT FROM NEW.beta_status)
  EXECUTE FUNCTION log_beta_status_change();
