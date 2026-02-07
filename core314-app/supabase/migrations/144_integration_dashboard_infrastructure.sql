-- ============================================================
-- Integration Dashboard Infrastructure
-- Creates tables for per-integration dashboards with real data
-- ============================================================

-- 1. Integration Metrics Table
-- Stores normalized metrics calculated from raw integration_events data
CREATE TABLE IF NOT EXISTS public.integration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT,
  dimensions JSONB DEFAULT '{}',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration_type, metric_name, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_integration_metrics_user ON public.integration_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_type ON public.integration_metrics(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_name ON public.integration_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_calculated ON public.integration_metrics(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_user_type ON public.integration_metrics(user_id, integration_type);

ALTER TABLE public.integration_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integration metrics"
ON public.integration_metrics FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage integration metrics"
ON public.integration_metrics FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.integration_metrics TO service_role;
GRANT SELECT ON public.integration_metrics TO authenticated;

-- 2. Integration Metric Definitions Table
-- Defines what metrics are available for each integration type
CREATE TABLE IF NOT EXISTS public.integration_metric_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  description TEXT,
  metric_unit TEXT,
  aggregation_type TEXT DEFAULT 'sum', -- sum, avg, count, max, min, latest
  source_event_type TEXT, -- event_type in integration_events to source from
  source_field_path TEXT, -- JSON path in metadata to extract value
  calculation_formula TEXT, -- Optional formula for derived metrics
  is_primary BOOLEAN DEFAULT false, -- Primary metrics shown prominently
  display_order INTEGER DEFAULT 100,
  chart_type TEXT DEFAULT 'stat', -- stat, line, bar, pie, area
  chart_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_type, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_metric_definitions_type ON public.integration_metric_definitions(integration_type);
CREATE INDEX IF NOT EXISTS idx_metric_definitions_primary ON public.integration_metric_definitions(is_primary);

ALTER TABLE public.integration_metric_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view metric definitions"
ON public.integration_metric_definitions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage metric definitions"
ON public.integration_metric_definitions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.integration_metric_definitions TO service_role;
GRANT SELECT ON public.integration_metric_definitions TO authenticated;

-- 3. Dashboard Configurations Table
-- Stores per-user dashboard configurations for each integration
CREATE TABLE IF NOT EXISTS public.dashboard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  layout JSONB DEFAULT '[]', -- Array of widget positions/sizes
  visible_metrics TEXT[] DEFAULT '{}', -- Which metrics to show
  refresh_interval_seconds INTEGER DEFAULT 300,
  theme JSONB DEFAULT '{}',
  is_auto_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_configs_user ON public.dashboard_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_type ON public.dashboard_configs(integration_type);

ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard configs"
ON public.dashboard_configs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own dashboard configs"
ON public.dashboard_configs FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage dashboard configs"
ON public.dashboard_configs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.dashboard_configs TO service_role;
GRANT ALL ON public.dashboard_configs TO authenticated;

-- 4. Seed default metric definitions for each integration type

-- Salesforce Metrics
INSERT INTO public.integration_metric_definitions (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type) VALUES
('salesforce', 'account_count', 'Total Accounts', 'Number of accounts in Salesforce', 'accounts', 'latest', 'salesforce.crm_activity', 'account_count', true, 1, 'stat'),
('salesforce', 'customer_accounts', 'Customer Accounts', 'Number of customer accounts', 'accounts', 'latest', 'salesforce.crm_activity', 'customer_accounts', false, 2, 'stat'),
('salesforce', 'prospect_accounts', 'Prospect Accounts', 'Number of prospect accounts', 'accounts', 'latest', 'salesforce.crm_activity', 'prospect_accounts', false, 3, 'stat'),
('salesforce', 'opportunity_count', 'Total Opportunities', 'Number of opportunities', 'opportunities', 'latest', 'salesforce.crm_activity', 'opportunity_count', true, 4, 'stat'),
('salesforce', 'open_opportunities', 'Open Opportunities', 'Number of open opportunities', 'opportunities', 'latest', 'salesforce.crm_activity', 'open_opportunities', true, 5, 'stat'),
('salesforce', 'won_opportunities', 'Won Opportunities', 'Number of won opportunities', 'opportunities', 'latest', 'salesforce.crm_activity', 'won_opportunities', false, 6, 'stat'),
('salesforce', 'lost_opportunities', 'Lost Opportunities', 'Number of lost opportunities', 'opportunities', 'latest', 'salesforce.crm_activity', 'lost_opportunities', false, 7, 'stat'),
('salesforce', 'opportunity_value', 'Pipeline Value', 'Total value of opportunities', 'USD', 'latest', 'salesforce.crm_activity', 'opportunity_value', true, 8, 'stat'),
('salesforce', 'case_count', 'Total Cases', 'Number of support cases', 'cases', 'latest', 'salesforce.crm_activity', 'case_count', false, 9, 'stat'),
('salesforce', 'open_cases', 'Open Cases', 'Number of open cases', 'cases', 'latest', 'salesforce.crm_activity', 'open_cases', true, 10, 'stat'),
('salesforce', 'escalated_cases', 'Escalated Cases', 'Number of escalated cases', 'cases', 'latest', 'salesforce.crm_activity', 'escalated_cases', false, 11, 'stat'),
('salesforce', 'win_rate', 'Win Rate', 'Percentage of opportunities won', '%', 'calculated', NULL, NULL, true, 12, 'stat')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Slack Metrics
INSERT INTO public.integration_metric_definitions (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type) VALUES
('slack', 'message_count', 'Messages', 'Total messages in workspace', 'messages', 'latest', 'slack.workspace_activity', 'message_count', true, 1, 'stat'),
('slack', 'active_channels', 'Active Channels', 'Number of active channels', 'channels', 'latest', 'slack.workspace_activity', 'active_channels', true, 2, 'stat'),
('slack', 'total_members', 'Team Members', 'Total workspace members', 'members', 'latest', 'slack.workspace_activity', 'total_members', true, 3, 'stat'),
('slack', 'active_members', 'Active Members', 'Members active in last 24h', 'members', 'latest', 'slack.workspace_activity', 'active_members', false, 4, 'stat'),
('slack', 'files_shared', 'Files Shared', 'Number of files shared', 'files', 'latest', 'slack.workspace_activity', 'files_shared', false, 5, 'stat'),
('slack', 'reactions_count', 'Reactions', 'Total reactions given', 'reactions', 'latest', 'slack.workspace_activity', 'reactions_count', false, 6, 'stat')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Google Calendar Metrics
INSERT INTO public.integration_metric_definitions (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type) VALUES
('google_calendar', 'event_count', 'Total Events', 'Number of calendar events', 'events', 'latest', 'gcal.calendar_activity', 'event_count', true, 1, 'stat'),
('google_calendar', 'upcoming_events', 'Upcoming Events', 'Events in next 7 days', 'events', 'latest', 'gcal.calendar_activity', 'upcoming_events', true, 2, 'stat'),
('google_calendar', 'meeting_hours', 'Meeting Hours', 'Total hours in meetings', 'hours', 'latest', 'gcal.calendar_activity', 'meeting_hours', true, 3, 'stat'),
('google_calendar', 'recurring_events', 'Recurring Events', 'Number of recurring events', 'events', 'latest', 'gcal.calendar_activity', 'recurring_events', false, 4, 'stat'),
('google_calendar', 'all_day_events', 'All-Day Events', 'Number of all-day events', 'events', 'latest', 'gcal.calendar_activity', 'all_day_events', false, 5, 'stat')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Zoom Metrics
INSERT INTO public.integration_metric_definitions (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type) VALUES
('zoom', 'meeting_count', 'Total Meetings', 'Number of meetings', 'meetings', 'latest', 'zoom.meeting_activity', 'meeting_count', true, 1, 'stat'),
('zoom', 'total_participants', 'Total Participants', 'Total meeting participants', 'participants', 'latest', 'zoom.meeting_activity', 'total_participants', true, 2, 'stat'),
('zoom', 'meeting_minutes', 'Meeting Minutes', 'Total minutes in meetings', 'minutes', 'latest', 'zoom.meeting_activity', 'meeting_minutes', true, 3, 'stat'),
('zoom', 'avg_duration', 'Avg Duration', 'Average meeting duration', 'minutes', 'latest', 'zoom.meeting_activity', 'avg_duration', false, 4, 'stat'),
('zoom', 'scheduled_meetings', 'Scheduled', 'Upcoming scheduled meetings', 'meetings', 'latest', 'zoom.meeting_activity', 'scheduled_meetings', false, 5, 'stat')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- QuickBooks Metrics
INSERT INTO public.integration_metric_definitions (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type) VALUES
('quickbooks', 'total_revenue', 'Total Revenue', 'Total revenue from invoices', 'USD', 'latest', 'quickbooks.financial_activity', 'total_revenue', true, 1, 'stat'),
('quickbooks', 'total_expenses', 'Total Expenses', 'Total expenses', 'USD', 'latest', 'quickbooks.financial_activity', 'total_expenses', true, 2, 'stat'),
('quickbooks', 'net_income', 'Net Income', 'Revenue minus expenses', 'USD', 'latest', 'quickbooks.financial_activity', 'net_income', true, 3, 'stat'),
('quickbooks', 'invoice_count', 'Invoices', 'Number of invoices', 'invoices', 'latest', 'quickbooks.financial_activity', 'invoice_count', false, 4, 'stat'),
('quickbooks', 'unpaid_invoices', 'Unpaid Invoices', 'Number of unpaid invoices', 'invoices', 'latest', 'quickbooks.financial_activity', 'unpaid_invoices', true, 5, 'stat'),
('quickbooks', 'accounts_receivable', 'Accounts Receivable', 'Outstanding receivables', 'USD', 'latest', 'quickbooks.financial_activity', 'accounts_receivable', false, 6, 'stat'),
('quickbooks', 'customer_count', 'Customers', 'Number of customers', 'customers', 'latest', 'quickbooks.financial_activity', 'customer_count', false, 7, 'stat')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Xero Metrics
INSERT INTO public.integration_metric_definitions (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type) VALUES
('xero', 'total_revenue', 'Total Revenue', 'Total revenue from invoices', 'USD', 'latest', 'xero.financial_activity', 'total_revenue', true, 1, 'stat'),
('xero', 'total_expenses', 'Total Expenses', 'Total expenses', 'USD', 'latest', 'xero.financial_activity', 'total_expenses', true, 2, 'stat'),
('xero', 'net_income', 'Net Income', 'Revenue minus expenses', 'USD', 'latest', 'xero.financial_activity', 'net_income', true, 3, 'stat'),
('xero', 'invoice_count', 'Invoices', 'Number of invoices', 'invoices', 'latest', 'xero.financial_activity', 'invoice_count', false, 4, 'stat'),
('xero', 'overdue_invoices', 'Overdue Invoices', 'Number of overdue invoices', 'invoices', 'latest', 'xero.financial_activity', 'overdue_invoices', true, 5, 'stat'),
('xero', 'bank_balance', 'Bank Balance', 'Total bank account balance', 'USD', 'latest', 'xero.financial_activity', 'bank_balance', true, 6, 'stat'),
('xero', 'contact_count', 'Contacts', 'Number of contacts', 'contacts', 'latest', 'xero.financial_activity', 'contact_count', false, 7, 'stat')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- Microsoft Teams Metrics
INSERT INTO public.integration_metric_definitions (integration_type, metric_name, metric_label, description, metric_unit, aggregation_type, source_event_type, source_field_path, is_primary, display_order, chart_type) VALUES
('microsoft_teams', 'message_count', 'Messages', 'Total messages sent', 'messages', 'latest', 'teams.activity', 'message_count', true, 1, 'stat'),
('microsoft_teams', 'channel_count', 'Channels', 'Number of channels', 'channels', 'latest', 'teams.activity', 'channel_count', true, 2, 'stat'),
('microsoft_teams', 'team_count', 'Teams', 'Number of teams', 'teams', 'latest', 'teams.activity', 'team_count', true, 3, 'stat'),
('microsoft_teams', 'active_users', 'Active Users', 'Users active in last 24h', 'users', 'latest', 'teams.activity', 'active_users', false, 4, 'stat'),
('microsoft_teams', 'meetings_count', 'Meetings', 'Number of meetings', 'meetings', 'latest', 'teams.activity', 'meetings_count', false, 5, 'stat')
ON CONFLICT (integration_type, metric_name) DO NOTHING;

-- 5. Function to auto-generate dashboard config when integration is connected
CREATE OR REPLACE FUNCTION public.auto_generate_dashboard_config()
RETURNS TRIGGER AS $$
DECLARE
  v_integration_type TEXT;
  v_metric_names TEXT[];
BEGIN
  -- Only trigger on status change to 'active'
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Get integration type from integrations_master
    SELECT integration_type INTO v_integration_type
    FROM public.integrations_master
    WHERE id = NEW.integration_id;
    
    IF v_integration_type IS NOT NULL THEN
      -- Get primary metrics for this integration type
      SELECT ARRAY_AGG(metric_name ORDER BY display_order)
      INTO v_metric_names
      FROM public.integration_metric_definitions
      WHERE integration_type = v_integration_type
      AND is_primary = true;
      
      -- Create dashboard config if it doesn't exist
      INSERT INTO public.dashboard_configs (user_id, integration_type, visible_metrics, is_auto_generated)
      VALUES (NEW.user_id, v_integration_type, COALESCE(v_metric_names, '{}'), true)
      ON CONFLICT (user_id, integration_type) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_integrations
DROP TRIGGER IF EXISTS trigger_auto_generate_dashboard ON public.user_integrations;
CREATE TRIGGER trigger_auto_generate_dashboard
  AFTER INSERT OR UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_dashboard_config();

-- 6. Function to calculate metrics from integration_events
CREATE OR REPLACE FUNCTION public.calculate_integration_metrics(
  p_user_id UUID,
  p_integration_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_metric RECORD;
  v_value NUMERIC;
  v_event_data JSONB;
  v_count INTEGER := 0;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  v_period_end := NOW();
  v_period_start := v_period_end - INTERVAL '24 hours';
  
  -- Get the latest event for this integration type
  SELECT metadata INTO v_event_data
  FROM public.integration_events
  WHERE user_id = p_user_id
  AND service_name = p_integration_type
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_event_data IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate each metric
  FOR v_metric IN 
    SELECT * FROM public.integration_metric_definitions
    WHERE integration_type = p_integration_type
    AND aggregation_type = 'latest'
  LOOP
    -- Extract value from event metadata
    v_value := (v_event_data ->> v_metric.source_field_path)::NUMERIC;
    
    IF v_value IS NOT NULL THEN
      INSERT INTO public.integration_metrics (
        user_id, integration_type, metric_name, metric_value, 
        metric_unit, period_start, period_end, calculated_at
      )
      VALUES (
        p_user_id, p_integration_type, v_metric.metric_name, v_value,
        v_metric.metric_unit, v_period_start, v_period_end, NOW()
      )
      ON CONFLICT (user_id, integration_type, metric_name, period_start, period_end)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, calculated_at = NOW();
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.auto_generate_dashboard_config() TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_integration_metrics(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_integration_metrics(UUID, TEXT) TO authenticated;

-- Comments
COMMENT ON TABLE public.integration_metrics IS 'Stores normalized metrics calculated from raw integration events';
COMMENT ON TABLE public.integration_metric_definitions IS 'Defines available metrics for each integration type';
COMMENT ON TABLE public.dashboard_configs IS 'Stores per-user dashboard configurations for each integration';
COMMENT ON FUNCTION public.auto_generate_dashboard_config() IS 'Automatically creates dashboard config when integration is connected';
COMMENT ON FUNCTION public.calculate_integration_metrics(UUID, TEXT) IS 'Calculates metrics from integration_events for a user and integration type';
