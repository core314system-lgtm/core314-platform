-- ============================================================================
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Base indexes for integration_events
CREATE INDEX IF NOT EXISTS idx_integration_events_service_name ON public.integration_events(service_name);
CREATE INDEX IF NOT EXISTS idx_integration_events_event_type ON public.integration_events(event_type);
CREATE INDEX IF NOT EXISTS idx_integration_events_service_event ON public.integration_events(service_name, event_type);
CREATE INDEX IF NOT EXISTS idx_integration_events_user_id ON public.integration_events(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_created_at ON public.integration_events(created_at DESC);

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'integration_events'
      AND policyname = 'Platform admins can view integration events'
  ) THEN
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
  END IF;
END
$$;

COMMENT ON TABLE public.integration_events IS 'Logs all integration events from external systems for audit and debugging';
COMMENT ON COLUMN public.integration_events.service_name IS 'Name of the external service (e.g., stripe, teams, slack)';
COMMENT ON COLUMN public.integration_events.event_type IS 'Type of event (e.g., invoice.paid, subscription.created, alert.sent)';
COMMENT ON COLUMN public.integration_events.payload IS 'Full event payload as JSON for debugging and audit';
COMMENT ON COLUMN public.integration_events.user_id IS 'Associated user ID if applicable (nullable for system events)';

-- ============================================================================
-- 2. Add Phase 19 columns to integration_events
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.integration_events 
      ADD COLUMN status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'pending'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'error_code'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN error_code TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'error_message'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN error_message TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'http_status'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN http_status INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integration_events' 
    AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE public.integration_events ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_integration_events_status_created 
  ON public.integration_events(status, created_at DESC);

COMMENT ON COLUMN public.integration_events.status IS 'Event status: success, error, or pending';
COMMENT ON COLUMN public.integration_events.error_code IS 'Error code from the integration provider';
COMMENT ON COLUMN public.integration_events.error_message IS 'Human-readable error message';
COMMENT ON COLUMN public.integration_events.http_status IS 'HTTP status code from the integration request';
COMMENT ON COLUMN public.integration_events.retry_count IS 'Number of retry attempts for this event';

-- ============================================================================
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integrations_master' 
    AND column_name = 'oauth_config'
  ) THEN
    ALTER TABLE public.integrations_master ADD COLUMN oauth_config JSONB;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integrations_master' 
    AND column_name = 'recovery_fail_count'
  ) THEN
    ALTER TABLE public.integrations_master ADD COLUMN recovery_fail_count INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integrations_master' 
    AND column_name = 'last_recovery_at'
  ) THEN
    ALTER TABLE public.integrations_master ADD COLUMN last_recovery_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'integrations_master' 
    AND column_name = 'auto_recovery_enabled'
  ) THEN
    ALTER TABLE public.integrations_master ADD COLUMN auto_recovery_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

COMMENT ON COLUMN public.integrations_master.oauth_config IS 'OAuth2 configuration: {token_url, client_id, client_secret, scopes}';
COMMENT ON COLUMN public.integrations_master.recovery_fail_count IS 'Number of consecutive recovery failures';
COMMENT ON COLUMN public.integrations_master.last_recovery_at IS 'Timestamp of last recovery attempt';
COMMENT ON COLUMN public.integrations_master.auto_recovery_enabled IS 'Whether automatic recovery is enabled for this integration';

-- ============================================================================
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_integrations' 
    AND column_name = 'access_token'
  ) THEN
    ALTER TABLE public.user_integrations ADD COLUMN access_token TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_integrations' 
    AND column_name = 'refresh_token'
  ) THEN
    ALTER TABLE public.user_integrations ADD COLUMN refresh_token TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_integrations' 
    AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE public.user_integrations ADD COLUMN token_expires_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_integrations' 
    AND column_name = 'last_error_at'
  ) THEN
    ALTER TABLE public.user_integrations ADD COLUMN last_error_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_integrations' 
    AND column_name = 'consecutive_failures'
  ) THEN
    ALTER TABLE public.user_integrations ADD COLUMN consecutive_failures INTEGER DEFAULT 0;
  END IF;
END $$;

DROP POLICY IF EXISTS "Service role can manage user integration tokens" ON public.user_integrations;
CREATE POLICY "Service role can manage user integration tokens"
  ON public.user_integrations FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
  );

COMMENT ON COLUMN public.user_integrations.access_token IS 'OAuth2 access token (service_role only)';
COMMENT ON COLUMN public.user_integrations.refresh_token IS 'OAuth2 refresh token (service_role only)';
COMMENT ON COLUMN public.user_integrations.token_expires_at IS 'Access token expiration timestamp';
COMMENT ON COLUMN public.user_integrations.last_error_at IS 'Timestamp of last integration error';
COMMENT ON COLUMN public.user_integrations.consecutive_failures IS 'Number of consecutive failures for this user integration';

-- ============================================================================
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_recovery_processed(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.system_integrity_events
    WHERE event_id = p_event_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_recovery_processed IS 'Check if a recovery action has already been processed for a given event_id (idempotency check)';

GRANT EXECUTE ON FUNCTION public.check_recovery_processed TO authenticated;

-- ============================================================================
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_integration_token_status(
  p_service_name TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  has_token BOOLEAN,
  is_expired BOOLEAN,
  expires_at TIMESTAMPTZ,
  consecutive_failures INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ui.access_token IS NOT NULL AS has_token,
    (ui.token_expires_at IS NOT NULL AND ui.token_expires_at < NOW()) AS is_expired,
    ui.token_expires_at AS expires_at,
    ui.consecutive_failures AS consecutive_failures
  FROM public.user_integrations ui
  JOIN public.integrations_master im ON ui.integration_id = im.id
  WHERE im.integration_name = p_service_name
    AND ui.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_integration_token_status IS 'Get token status for a user integration (used by self-healing system)';

GRANT EXECUTE ON FUNCTION public.get_integration_token_status TO authenticated;
