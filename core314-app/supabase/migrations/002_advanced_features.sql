
CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  config_data JSONB NOT NULL,
  credentials_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_frequency TEXT DEFAULT 'hourly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE api_schemas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES integration_configs(id) ON DELETE CASCADE,
  schema_data JSONB NOT NULL,
  schema_version TEXT,
  embedding vector(1536),
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_analyzed TIMESTAMP WITH TIME ZONE
);

CREATE TABLE auto_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES integration_configs(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_type TEXT CHECK (metric_type IN ('count', 'sum', 'average', 'percentage', 'trend')),
  data_path JSONB NOT NULL,
  unit TEXT,
  chart_type TEXT CHECK (chart_type IN ('line', 'bar', 'donut', 'gauge', 'table')),
  ai_confidence FLOAT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_name TEXT NOT NULL,
  integration_id UUID REFERENCES integration_configs(id) ON DELETE CASCADE,
  layout_config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE metric_data_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_id UUID REFERENCES auto_metrics(id) ON DELETE CASCADE,
  data_value JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);


CREATE TABLE user_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_name TEXT NOT NULL,
  goal_type TEXT CHECK (goal_type IN ('okr', 'kpi', 'milestone', 'target')),
  target_metric TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  target_date DATE,
  current_value NUMERIC DEFAULT 0,
  progress_percentage NUMERIC GENERATED ALWAYS AS (
    CASE WHEN target_value > 0 THEN (current_value / target_value * 100) ELSE 0 END
  ) STORED,
  status TEXT CHECK (status IN ('on_track', 'at_risk', 'off_track', 'completed')) DEFAULT 'on_track',
  linked_integration_id UUID REFERENCES integration_configs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES user_goals(id) ON DELETE CASCADE,
  snapshot_value NUMERIC NOT NULL,
  snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE goal_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES user_goals(id) ON DELETE CASCADE,
  recommendation_text TEXT NOT NULL,
  reasoning TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'accepted', 'dismissed', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT CHECK (rule_type IN ('threshold', 'anomaly', 'forecast', 'schedule')),
  trigger_condition JSONB NOT NULL,
  linked_metric_id UUID REFERENCES auto_metrics(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_type TEXT CHECK (channel_type IN ('email', 'sms', 'slack', 'teams')),
  channel_config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE alert_channel_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES notification_channels(id) ON DELETE CASCADE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  UNIQUE(alert_rule_id, channel_id)
);

CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  channels_sent JSONB NOT NULL,
  delivery_status JSONB,
  alert_payload JSONB NOT NULL
);


CREATE TABLE integration_health_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES integration_configs(id) ON DELETE CASCADE,
  check_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms INTEGER,
  error_message TEXT
);

CREATE TABLE integration_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES integration_configs(id) ON DELETE CASCADE,
  token_type TEXT CHECK (token_type IN ('access', 'refresh')),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_expired BOOLEAN GENERATED ALWAYS AS (expires_at < NOW()) STORED,
  last_refreshed TIMESTAMP WITH TIME ZONE
);


CREATE TABLE ai_reasoning_traces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recommendation_id UUID REFERENCES goal_recommendations(id) ON DELETE CASCADE,
  reasoning_steps JSONB NOT NULL,
  data_sources JSONB NOT NULL,
  confidence_score FLOAT,
  model_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE INDEX idx_integration_configs_user ON integration_configs(user_id, is_active);
CREATE INDEX idx_api_schemas_integration ON api_schemas(integration_id);
CREATE INDEX idx_api_schemas_embedding ON api_schemas USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_auto_metrics_integration ON auto_metrics(integration_id, is_enabled);
CREATE INDEX idx_dashboard_layouts_user ON dashboard_layouts(user_id);
CREATE INDEX idx_metric_cache_metric ON metric_data_cache(metric_id, cached_at DESC);

CREATE INDEX idx_user_goals_user ON user_goals(user_id, status);
CREATE INDEX idx_kpi_snapshots_goal ON kpi_snapshots(goal_id, snapshot_time DESC);
CREATE INDEX idx_goal_recommendations_goal ON goal_recommendations(goal_id, status);

CREATE INDEX idx_alert_rules_user ON alert_rules(user_id, is_active);
CREATE INDEX idx_notification_channels_user ON notification_channels(user_id);
CREATE INDEX idx_alert_history_rule ON alert_history(alert_rule_id, triggered_at DESC);

CREATE INDEX idx_health_logs_integration ON integration_health_logs(integration_id, check_time DESC);
CREATE INDEX idx_integration_tokens_expiry ON integration_tokens(integration_id, expires_at);

CREATE INDEX idx_reasoning_traces_recommendation ON ai_reasoning_traces(recommendation_id);


ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_channel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reasoning_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations" ON integration_configs
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users view own schemas" ON api_schemas
  FOR SELECT USING (
    integration_id IN (SELECT id FROM integration_configs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users view own metrics" ON auto_metrics
  FOR SELECT USING (
    integration_id IN (SELECT id FROM integration_configs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own dashboards" ON dashboard_layouts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users view cached data" ON metric_data_cache
  FOR SELECT USING (
    metric_id IN (
      SELECT id FROM auto_metrics WHERE integration_id IN (
        SELECT id FROM integration_configs WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users manage own goals" ON user_goals
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users view own snapshots" ON kpi_snapshots
  FOR SELECT USING (
    goal_id IN (SELECT id FROM user_goals WHERE user_id = auth.uid())
  );

CREATE POLICY "Users view own recommendations" ON goal_recommendations
  FOR ALL USING (
    goal_id IN (SELECT id FROM user_goals WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own alerts" ON alert_rules
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage own channels" ON notification_channels
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage alert channels" ON alert_channel_preferences
  FOR ALL USING (
    alert_rule_id IN (SELECT id FROM alert_rules WHERE user_id = auth.uid())
  );

CREATE POLICY "Users view own alert history" ON alert_history
  FOR SELECT USING (
    alert_rule_id IN (SELECT id FROM alert_rules WHERE user_id = auth.uid())
  );

CREATE POLICY "Users view own health logs" ON integration_health_logs
  FOR SELECT USING (
    integration_id IN (SELECT id FROM integration_configs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users view own tokens" ON integration_tokens
  FOR SELECT USING (
    integration_id IN (SELECT id FROM integration_configs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users view own reasoning" ON ai_reasoning_traces
  FOR SELECT USING (
    recommendation_id IN (
      SELECT id FROM goal_recommendations WHERE goal_id IN (
        SELECT id FROM user_goals WHERE user_id = auth.uid()
      )
    )
  );


CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON integration_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_layouts_updated_at BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at BEFORE UPDATE ON user_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goal_recommendations_updated_at BEFORE UPDATE ON goal_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
