-- ============================================================================
-- SYSTEM HEALTH MONITORING — RELIABILITY LAYER
-- ============================================================================
-- Central table for tracking success/failure of all critical system operations.
-- Used by logSystemEvent() from Edge Functions and backend services.
-- ============================================================================

-- Create system_health_logs table
CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by service and status
CREATE INDEX IF NOT EXISTS idx_system_health_logs_service ON public.system_health_logs (service);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_status ON public.system_health_logs (status);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_created_at ON public.system_health_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_service_status ON public.system_health_logs (service, status);

-- RLS: Only service_role can insert/read (Edge Functions use service_role key)
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (Edge Functions always use service_role)
CREATE POLICY "service_role_full_access" ON public.system_health_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated admin users to read logs (for admin dashboard)
CREATE POLICY "admin_read_health_logs" ON public.system_health_logs
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Comment on table
COMMENT ON TABLE public.system_health_logs IS 'Central system health monitoring table — tracks success/failure of all critical operations';
COMMENT ON COLUMN public.system_health_logs.service IS 'Service identifier: stripe_webhook, stripe_checkout, user_creation, email_send, integration_ingestion';
COMMENT ON COLUMN public.system_health_logs.status IS 'Operation result: success or failure';
COMMENT ON COLUMN public.system_health_logs.message IS 'Human-readable description of the event or error';
COMMENT ON COLUMN public.system_health_logs.metadata IS 'Optional JSON payload with additional context';
