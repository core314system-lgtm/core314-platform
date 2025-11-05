
-- ============================================================================
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_integrity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,  -- Reference to integration_events.id (nullable for non-integration events)
  service_name TEXT NOT NULL,
  failure_reason TEXT,
  failure_category TEXT CHECK (failure_category IN ('auth', 'rate_limit', 'network', 'data', 'unknown')),
  action_taken TEXT,
  analyzer_signals JSONB,  -- Diagnostic details from analyzer
  llm_reasoning TEXT,  -- Optional AI reasoning if useLLM=true
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'disabled')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_integrity_events_service_status 
  ON public.system_integrity_events(service_name, status, created_at DESC);
CREATE INDEX idx_system_integrity_events_event_id 
  ON public.system_integrity_events(event_id);
CREATE INDEX idx_system_integrity_events_category 
  ON public.system_integrity_events(failure_category, created_at DESC);
CREATE INDEX idx_system_integrity_events_status_created
  ON public.system_integrity_events(status, created_at DESC);

ALTER TABLE public.system_integrity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view system integrity events"
  ON public.system_integrity_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Service role can insert system integrity events"
  ON public.system_integrity_events FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
  );

CREATE POLICY "Service role can update system integrity events"
  ON public.system_integrity_events FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
  );

CREATE POLICY "Service role can delete system integrity events"
  ON public.system_integrity_events FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
  );

CREATE TRIGGER update_system_integrity_events_updated_at
  BEFORE UPDATE ON public.system_integrity_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.system_integrity_events IS 'Logs self-healing actions for integration failures and system integrity issues';
COMMENT ON COLUMN public.system_integrity_events.event_id IS 'Reference to integration_events.id if this is an integration failure';
COMMENT ON COLUMN public.system_integrity_events.service_name IS 'Name of the service (slack, teams, stripe, etc.)';
COMMENT ON COLUMN public.system_integrity_events.failure_reason IS 'Human-readable description of the failure';
COMMENT ON COLUMN public.system_integrity_events.failure_category IS 'Categorized failure type: auth, rate_limit, network, data, unknown';
COMMENT ON COLUMN public.system_integrity_events.action_taken IS 'Description of the recovery action performed';
COMMENT ON COLUMN public.system_integrity_events.analyzer_signals IS 'Diagnostic signals from the analyzer (JSON)';
COMMENT ON COLUMN public.system_integrity_events.llm_reasoning IS 'Optional AI-generated reasoning if LLM analysis was used';
COMMENT ON COLUMN public.system_integrity_events.status IS 'Current status: pending (awaiting resolution), resolved (fixed), disabled (integration disabled)';
COMMENT ON COLUMN public.system_integrity_events.resolved_at IS 'Timestamp when the issue was resolved';

-- ============================================================================
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
