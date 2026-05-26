
-- ============================================================================
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.beta_user_notes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  internal_notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ============================================================================
CREATE TRIGGER update_beta_user_notes_updated_at
  BEFORE UPDATE ON public.beta_user_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ============================================================================
ALTER TABLE public.beta_user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage beta notes"
  ON public.beta_user_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- ============================================================================
CREATE INDEX IF NOT EXISTS beta_user_notes_user_id_idx ON public.beta_user_notes(user_id);
CREATE INDEX IF NOT EXISTS beta_user_notes_updated_at_idx ON public.beta_user_notes(updated_at DESC);

-- ============================================================================
-- ============================================================================
COMMENT ON TABLE public.beta_user_notes IS 'Admin-only internal notes about beta users for operational tracking and monitoring';
COMMENT ON COLUMN public.beta_user_notes.internal_notes IS 'Free-form text notes for admins to track observations, issues, or follow-ups';
