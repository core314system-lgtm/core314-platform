-- ============================================================
-- Integration Review Queue
-- Tracks custom integrations pending validation/approval
-- ============================================================

-- Create integration_review_queue table
CREATE TABLE IF NOT EXISTS public.integration_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_registry_id UUID NOT NULL REFERENCES public.integration_registry(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'approved', 'rejected', 'requires_review')),
  validation_results JSONB DEFAULT '{}'::jsonb,
  inferred_schema JSONB DEFAULT '{}'::jsonb,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_integration_review_queue_status 
  ON public.integration_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_integration_review_queue_user 
  ON public.integration_review_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_review_queue_registry 
  ON public.integration_review_queue(integration_registry_id);
CREATE INDEX IF NOT EXISTS idx_integration_review_queue_risk_score 
  ON public.integration_review_queue(risk_score);
CREATE INDEX IF NOT EXISTS idx_integration_review_queue_created 
  ON public.integration_review_queue(created_at DESC);

-- Enable RLS
ALTER TABLE public.integration_review_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role has full access
DROP POLICY IF EXISTS "Service role full access on integration_review_queue" ON public.integration_review_queue;
CREATE POLICY "Service role full access on integration_review_queue"
ON public.integration_review_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own review queue entries
DROP POLICY IF EXISTS "Users can view own review entries" ON public.integration_review_queue;
CREATE POLICY "Users can view own review entries"
ON public.integration_review_queue FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view and manage all review entries
DROP POLICY IF EXISTS "Admins can manage review queue" ON public.integration_review_queue;
CREATE POLICY "Admins can manage review queue"
ON public.integration_review_queue FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_platform_admin = true)
  )
);

-- Grant permissions
GRANT ALL ON public.integration_review_queue TO service_role;
GRANT SELECT ON public.integration_review_queue TO authenticated;

-- Function to submit integration for review
CREATE OR REPLACE FUNCTION submit_integration_for_review(
  p_integration_registry_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_id UUID;
BEGIN
  INSERT INTO integration_review_queue (
    integration_registry_id,
    user_id,
    status
  ) VALUES (
    p_integration_registry_id,
    p_user_id,
    'pending'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

-- Function to update review status with validation results
CREATE OR REPLACE FUNCTION update_integration_review(
  p_review_id UUID,
  p_risk_score INTEGER,
  p_status TEXT,
  p_validation_results JSONB,
  p_inferred_schema JSONB,
  p_risk_factors JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE integration_review_queue
  SET 
    risk_score = p_risk_score,
    status = p_status,
    validation_results = p_validation_results,
    inferred_schema = p_inferred_schema,
    risk_factors = p_risk_factors,
    updated_at = NOW()
  WHERE id = p_review_id;

  -- If auto-approved (risk_score < 70), also enable the integration
  IF p_status = 'approved' THEN
    UPDATE integration_registry
    SET is_enabled = true, updated_at = NOW()
    WHERE id = (
      SELECT integration_registry_id 
      FROM integration_review_queue 
      WHERE id = p_review_id
    );
  END IF;

  RETURN FOUND;
END;
$$;

-- Function for admin to manually approve/reject
CREATE OR REPLACE FUNCTION admin_review_integration(
  p_review_id UUID,
  p_status TEXT,
  p_reviewer_notes TEXT,
  p_reviewer_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify reviewer is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_reviewer_id AND (role = 'admin' OR is_platform_admin = true)
  ) THEN
    RAISE EXCEPTION 'Only admins can review integrations';
  END IF;

  UPDATE integration_review_queue
  SET 
    status = p_status,
    reviewer_id = p_reviewer_id,
    reviewer_notes = p_reviewer_notes,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_review_id;

  -- Update integration enabled status based on review
  IF p_status = 'approved' THEN
    UPDATE integration_registry
    SET is_enabled = true, updated_at = NOW()
    WHERE id = (
      SELECT integration_registry_id 
      FROM integration_review_queue 
      WHERE id = p_review_id
    );
  ELSIF p_status = 'rejected' THEN
    UPDATE integration_registry
    SET is_enabled = false, updated_at = NOW()
    WHERE id = (
      SELECT integration_registry_id 
      FROM integration_review_queue 
      WHERE id = p_review_id
    );
  END IF;

  RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION submit_integration_for_review TO service_role;
GRANT EXECUTE ON FUNCTION update_integration_review TO service_role;
GRANT EXECUTE ON FUNCTION admin_review_integration TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.integration_review_queue IS 'Queue for custom integrations pending validation and approval';
COMMENT ON COLUMN public.integration_review_queue.risk_score IS 'Risk score 0-100, auto-approved if < 70';
COMMENT ON COLUMN public.integration_review_queue.validation_results IS 'Results from the sandbox validator';
COMMENT ON COLUMN public.integration_review_queue.inferred_schema IS 'JSON schema inferred from API response';
COMMENT ON COLUMN public.integration_review_queue.risk_factors IS 'Array of identified risk factors';
