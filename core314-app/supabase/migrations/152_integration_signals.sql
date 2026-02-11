-- ============================================================
-- Integration Signals Infrastructure
-- Creates tables for normalized signals from raw integration events
-- Part of Integration Architecture v2.0
-- ============================================================

-- 1. Integration Signals Table
-- Stores normalized signals extracted from raw integration_events
CREATE TABLE IF NOT EXISTS public.integration_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  signal_group TEXT NOT NULL CHECK (signal_group IN (
    'activity_volume', 
    'activity_velocity', 
    'user_engagement', 
    'system_health', 
    'risk_indicators'
  )),
  signal_name TEXT NOT NULL,
  signal_value NUMERIC NOT NULL,
  signal_metadata JSONB DEFAULT '{}',
  source_event_id UUID REFERENCES public.integration_events(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_signals_user ON public.integration_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_signals_type ON public.integration_signals(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_signals_group ON public.integration_signals(signal_group);
CREATE INDEX IF NOT EXISTS idx_integration_signals_user_type ON public.integration_signals(user_id, integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_signals_occurred ON public.integration_signals(occurred_at DESC);

ALTER TABLE public.integration_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signals"
ON public.integration_signals FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage signals"
ON public.integration_signals FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.integration_signals TO service_role;
GRANT SELECT ON public.integration_signals TO authenticated;

-- 2. Integration Signal Mappings Table
-- Defines how raw events map to canonical signals
CREATE TABLE IF NOT EXISTS public.integration_signal_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type TEXT NOT NULL,
  source_event_type TEXT NOT NULL,
  source_field_path TEXT NOT NULL,
  target_signal_group TEXT NOT NULL CHECK (target_signal_group IN (
    'activity_volume', 
    'activity_velocity', 
    'user_engagement', 
    'system_health', 
    'risk_indicators'
  )),
  target_signal_name TEXT NOT NULL,
  transformation TEXT DEFAULT 'direct' CHECK (transformation IN ('direct', 'count', 'sum', 'avg', 'delta', 'increment')),
  default_value NUMERIC DEFAULT 1,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(integration_type, source_event_type, target_signal_name)
);

CREATE INDEX IF NOT EXISTS idx_signal_mappings_type ON public.integration_signal_mappings(integration_type);
CREATE INDEX IF NOT EXISTS idx_signal_mappings_event ON public.integration_signal_mappings(source_event_type);
CREATE INDEX IF NOT EXISTS idx_signal_mappings_enabled ON public.integration_signal_mappings(is_enabled);

ALTER TABLE public.integration_signal_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view signal mappings"
ON public.integration_signal_mappings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage signal mappings"
ON public.integration_signal_mappings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.integration_signal_mappings TO service_role;
GRANT SELECT ON public.integration_signal_mappings TO authenticated;

-- Comments
COMMENT ON TABLE public.integration_signals IS 'Normalized signals extracted from raw integration events using UIC';
COMMENT ON TABLE public.integration_signal_mappings IS 'Defines how raw events map to canonical signal groups';
COMMENT ON COLUMN public.integration_signals.signal_group IS 'Canonical signal group: activity_volume, activity_velocity, user_engagement, system_health, risk_indicators';
COMMENT ON COLUMN public.integration_signal_mappings.transformation IS 'How to transform the source value: direct (use as-is), count (count occurrences), increment (add 1)';
