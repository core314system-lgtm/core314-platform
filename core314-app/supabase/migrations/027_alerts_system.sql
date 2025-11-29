
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('reliability', 'churn', 'onboarding', 'signup', 'system')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  throttle_key TEXT NOT NULL, -- Unique key for deduplication (e.g., "churn:critical:user_123")
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alert_throttle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  throttle_key TEXT NOT NULL UNIQUE,
  alert_type TEXT NOT NULL,
  last_sent TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON public.alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON public.alerts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_throttle_key ON public.alerts(throttle_key);

CREATE INDEX IF NOT EXISTS idx_throttle_key ON public.alert_throttle(throttle_key);
CREATE INDEX IF NOT EXISTS idx_throttle_last_sent ON public.alert_throttle(last_sent DESC);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_throttle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view alerts"
  ON public.alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert alerts"
  ON public.alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update alerts"
  ON public.alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role only for alert_throttle"
  ON public.alert_throttle
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.alerts IS 'Phase 23: Stores all system alerts including reliability, churn, onboarding, signup, and system anomaly alerts';
COMMENT ON TABLE public.alert_throttle IS 'Phase 23: Tracks throttle state to prevent alert spam (30-minute TTL per throttle_key)';
COMMENT ON COLUMN public.alerts.throttle_key IS 'Unique key for deduplication (e.g., "churn:critical:user_abc123", "reliability:latency_spike:module_api")';
COMMENT ON COLUMN public.alerts.metadata IS 'JSON metadata with alert-specific details (e.g., user info, metrics, thresholds)';
