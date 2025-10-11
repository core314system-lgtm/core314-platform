export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'user';
  avatar_url?: string;
  two_factor_enabled: boolean;
  subscription_tier: 'none' | 'starter' | 'professional' | 'enterprise';
  subscription_status: 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  integration_type: 'slack' | 'microsoft_teams' | 'microsoft_365' | 'outlook' | 'gmail' | 'trello' | 'sendgrid';
  status: 'active' | 'inactive' | 'error' | 'syncing';
  credentials?: Record<string, unknown>;
  config?: Record<string, unknown>;
  last_sync_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface AIAgent {
  id: string;
  name: string;
  agent_type: 'orchestrator' | 'task_executor' | 'monitor' | 'analyzer';
  status: 'active' | 'inactive' | 'error';
  config?: Record<string, unknown>;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AITask {
  id: string;
  agent_id: string;
  user_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

export interface SystemHealth {
  id: string;
  service_name: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time_ms?: number;
  last_check_at: string;
  error_message?: string;
  created_at: string;
}

export interface DailyMetrics {
  id: string;
  metric_date: string;
  total_users: number;
  active_users: number;
  total_integrations: number;
  active_integrations: number;
  ai_tasks_executed: number;
  ai_tasks_failed: number;
  api_calls: number;
  errors: number;
  created_at: string;
}

export interface SubscriptionFeatures {
  tier: 'none' | 'starter' | 'professional' | 'enterprise';
  status: string;
  maxUsers: number;
  maxIntegrations: number;
  features: string[];
}

export interface Lead {
  id: string;
  name?: string;
  email: string;
  company?: string;
  industry?: string;
  is_beta_tester: boolean;
  created_at: string;
}
export interface IntegrationConfig {
  id: string;
  user_id: string;
  integration_type: string;
  config_data: {
    base_url?: string;
    api_key?: string;
    oauth_token?: string;
    [key: string]: unknown;
  };
  credentials_encrypted?: string;
  is_active: boolean;
  last_sync?: string;
  sync_frequency: string;
  created_at: string;
  updated_at: string;
}

export interface APISchema {
  id: string;
  integration_id: string;
  schema_data: object;
  schema_version?: string;
  embedding?: number[];
  discovered_at: string;
  last_analyzed?: string;
}

export interface AutoMetric {
  id: string;
  integration_id: string;
  metric_name: string;
  metric_type: 'count' | 'sum' | 'average' | 'percentage' | 'trend';
  data_path: { path: string[] };
  unit?: string;
  chart_type: 'line' | 'bar' | 'donut' | 'gauge' | 'table';
  ai_confidence?: number;
  is_enabled: boolean;
  created_at: string;
}

export interface DashboardLayout {
  id: string;
  user_id: string;
  dashboard_name: string;
  integration_id: string;
  layout_config: {
    dashboard_name: string;
    widgets: DashboardWidget[];
    refresh_interval: number;
  };
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  metric_id: string;
  metric_name: string;
  chart_type: 'line' | 'bar' | 'donut' | 'gauge' | 'table';
  data_config: {
    metric_type: string;
    data_path: string[];
    unit?: string;
  };
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface UserGoal {
  id: string;
  user_id: string;
  goal_name: string;
  goal_type: 'okr' | 'kpi' | 'milestone' | 'target';
  target_metric: string;
  target_value: number;
  target_date?: string;
  current_value: number;
  progress_percentage: number;
  status: 'on_track' | 'at_risk' | 'off_track' | 'completed';
  linked_integration_id?: string;
  created_at: string;
  updated_at: string;
}

export interface KPISnapshot {
  id: string;
  goal_id: string;
  snapshot_value: number;
  snapshot_time: string;
}

export interface GoalRecommendation {
  id: string;
  goal_id: string;
  recommendation_text: string;
  reasoning?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'accepted' | 'dismissed' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface AlertRule {
  id: string;
  user_id: string;
  rule_name: string;
  rule_type: 'threshold' | 'anomaly' | 'forecast' | 'schedule';
  trigger_condition: object;
  linked_metric_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationChannel {
  id: string;
  user_id: string;
  channel_type: 'email' | 'sms' | 'slack' | 'teams';
  channel_config: {
    address?: string;
    webhook_url?: string;
    [key: string]: unknown;
  };
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface AlertHistory {
  id: string;
  alert_rule_id: string;
  triggered_at: string;
  channels_sent: object;
  delivery_status: object;
  alert_payload: object;
}

export interface IntegrationHealthLog {
  id: string;
  integration_id: string;
  check_time: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time_ms?: number;
  error_message?: string;
}

export interface IntegrationToken {
  id: string;
  integration_id: string;
  token_type: 'access' | 'refresh';
  expires_at?: string;
  is_expired: boolean;
  last_refreshed?: string;
}

export interface AIReasoningTrace {
  id: string;
  recommendation_id: string;
  reasoning_steps: object;
  data_sources: object;
  confidence_score?: number;
  model_version?: string;
  created_at: string;
}
