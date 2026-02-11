-- ============================================================
-- Webhook Subscriptions Infrastructure
-- Tracks active webhook registrations for event-driven integrations
-- Part of Integration Architecture v2.0
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_integration_id UUID NOT NULL REFERENCES public.user_integrations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_secret_id UUID, -- Reference to vault secret for signature verification
  event_types TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed', 'disabled')),
  last_event_at TIMESTAMPTZ,
  last_event_id TEXT, -- Provider-specific event ID for deduplication
  failure_count INTEGER DEFAULT 0,
  last_failure_reason TEXT,
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_user ON public.webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_type ON public.webhook_subscriptions(integration_type);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_status ON public.webhook_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_user_type ON public.webhook_subscriptions(user_id, integration_type);

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own webhook subscriptions"
ON public.webhook_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage webhook subscriptions"
ON public.webhook_subscriptions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.webhook_subscriptions TO service_role;
GRANT SELECT ON public.webhook_subscriptions TO authenticated;

-- Function to update webhook subscription status
CREATE OR REPLACE FUNCTION public.update_webhook_subscription_status(
  p_user_id UUID,
  p_integration_type TEXT,
  p_status TEXT,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.webhook_subscriptions
  SET 
    status = p_status,
    last_failure_reason = COALESCE(p_failure_reason, last_failure_reason),
    failure_count = CASE WHEN p_status = 'failed' THEN failure_count + 1 ELSE failure_count END,
    updated_at = NOW()
  WHERE user_id = p_user_id AND integration_type = p_integration_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_webhook_subscription_status(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Comments
COMMENT ON TABLE public.webhook_subscriptions IS 'Tracks active webhook registrations for event-driven integrations';
COMMENT ON COLUMN public.webhook_subscriptions.status IS 'Subscription status: pending (awaiting verification), active (receiving events), failed (errors), disabled (manually turned off)';
COMMENT ON COLUMN public.webhook_subscriptions.event_types IS 'Array of event types this subscription receives';
