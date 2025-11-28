
CREATE TABLE IF NOT EXISTS public.system_reliability_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL,
  module TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  http_status INT,
  latency_ms INT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reliability_created ON public.system_reliability_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reliability_severity ON public.system_reliability_events(severity);
CREATE INDEX IF NOT EXISTS idx_reliability_module ON public.system_reliability_events(module);

ALTER TABLE public.system_reliability_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view reliability events"
  ON public.system_reliability_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE public.system_reliability_events IS 'Phase 22: Stores system reliability events for monitoring platform health, API errors, latency spikes, and uptime signals';
