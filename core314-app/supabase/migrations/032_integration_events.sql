
CREATE TABLE IF NOT EXISTS public.integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_events_service_name ON public.integration_events(service_name);
CREATE INDEX idx_integration_events_event_type ON public.integration_events(event_type);
CREATE INDEX idx_integration_events_service_event ON public.integration_events(service_name, event_type);
CREATE INDEX idx_integration_events_user_id ON public.integration_events(user_id);
CREATE INDEX idx_integration_events_created_at ON public.integration_events(created_at DESC);

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view integration events"
  ON public.integration_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );


COMMENT ON TABLE public.integration_events IS 'Logs all integration events from external systems for audit and debugging';
COMMENT ON COLUMN public.integration_events.service_name IS 'Name of the external service (e.g., stripe, teams, slack)';
COMMENT ON COLUMN public.integration_events.event_type IS 'Type of event (e.g., invoice.paid, subscription.created, alert.sent)';
COMMENT ON COLUMN public.integration_events.payload IS 'Full event payload as JSON for debugging and audit';
COMMENT ON COLUMN public.integration_events.user_id IS 'Associated user ID if applicable (nullable for system events)';
