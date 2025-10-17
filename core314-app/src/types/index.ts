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
  maxMetricsPerIntegration?: number;
  hasAIInsights?: boolean;
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

export interface IntegrationMaster {
  id: string;
  integration_name: string;
  integration_type: string;
  logo_url?: string;
  is_core_integration: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface UserIntegration {
  id: string;
  user_id: string;
  integration_id: string;
  added_by_user: boolean;
  date_added: string;
  status: 'active' | 'inactive' | 'error';
  config?: Record<string, unknown>;
}

export interface IntegrationWithStatus extends IntegrationMaster {
  user_integration_id?: string;
  is_enabled: boolean;
  date_added?: string;
}

export interface FusionMetric {
  id: string;
  user_id: string;
  integration_id: string;
  metric_name: string;
  metric_type: 'count' | 'sum' | 'average' | 'percentage' | 'trend';
  raw_value: number;
  normalized_value: number;
  weight: number;
  data_source?: Record<string, unknown>;
  synced_at: string;
  created_at: string;
}

export interface FusionScore {
  id: string;
  user_id: string;
  integration_id: string;
  fusion_score: number;
  score_breakdown?: Record<string, unknown>;
  trend_direction: 'up' | 'down' | 'stable';
  ai_summary?: string;
  ai_cached_at?: string;
  calculated_at: string;
  created_at: string;
  updated_at: string;
  weight_factor: number;
  baseline_score: number;
  learning_rate: number;
  last_adjusted: string;
  adaptive_notes?: string;
}

export interface FusionScoreHistory {
  id: string;
  user_id: string;
  integration_id: string;
  fusion_score: number;
  weight_factor: number;
  baseline_score: number;
  learning_rate: number;
  recorded_at: string;
  change_reason: string;
}

export interface FusionWeighting {
  id: string;
  integration_id: string;
  user_id: string;
  metric_id: string;
  weight: number;
  ai_confidence: number;
  last_adjusted: string;
  adjustment_reason: string;
  adaptive: boolean;
  created_at: string;
}

export interface IntegrationWithScore extends IntegrationMaster {
  fusion_score?: number;
  trend_direction?: 'up' | 'down' | 'stable';
  ai_summary?: string;
  metrics_count: number;
}

export interface FusionInsight {
  id: string;
  user_id: string;
  integration_id: string;
  integration_name: string;
  insight_type: 'trend' | 'prediction' | 'anomaly' | 'summary';
  message: string;
  confidence: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  rule_name: string;
  integration_name: string;
  condition_type: 'anomaly' | 'trend' | 'prediction' | 'summary';
  condition_operator: '>' | '<' | '=' | 'contains';
  condition_value: string;
  action_type: 'notify_slack' | 'notify_email' | 'adjust_weight' | 'trigger_function';
  action_target: string;
  enabled: boolean;
  created_at: string;
}

export interface ActionLog {
  id: string;
  rule_id: string;
  integration_name: string;
  insight_id: string;
  action_type: string;
  action_result: string;
  status: 'success' | 'failed';
  created_at: string;
}

export interface AutomationActivity {
  total_actions_24h: number;
  success_rate: number;
  recent_actions: ActionLog[];
}

export interface TimelineDataPoint {
  date: string;
  fusion_score: number;
  variance: number;
}

export interface ForecastDataPoint {
  date: string;
  predicted_score: number;
  confidence_low: number;
  confidence_high: number;
}

export interface AnomalyDataPoint {
  date: string;
  severity: 'low' | 'medium' | 'high';
  type: string;
  message?: string;
}

export interface ActionDataPoint {
  timestamp: string;
  rule: string;
  result: string;
  integration: string;
}

export interface VisualizationData {
  timeline: TimelineDataPoint[];
  forecasts: ForecastDataPoint[];
  anomalies: AnomalyDataPoint[];
  actions: ActionDataPoint[];
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'analyst' | 'member';
  joined_at: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'analyst' | 'member';
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  invited_by: string;
  created_at: string;
  expires_at: string;
}

export interface OrganizationWithMembers extends Organization {
  member_count: number;
  user_role: 'owner' | 'admin' | 'analyst' | 'member';
}

export interface EventAutomationRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  trigger_type: string;
  condition: {
    metric: string;
    operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
    value: number;
  };
  action: {
    type: 'notify_slack' | 'notify_teams' | 'notify_email' | 'log_event' | 'trigger_recalibration';
    message?: string;
    [key: string]: string | number | boolean | undefined;
  };
  status: 'active' | 'paused' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
}

export interface EventAutomationLog {
  id: string;
  organization_id: string;
  rule_id: string;
  event_type: string;
  details: Record<string, unknown>;
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  created_at: string;
}

export interface EventNarrative {
  id: string;
  organization_id: string;
  title: string;
  summary: string;
  recommendations: string;
  data_context: {
    fusion_score?: number;
    top_integrations?: Array<{ name: string; score: number }>;
    automation_activity?: { total_rules: number; total_executions: number };
    key_insights?: string[];
  };
  ai_confidence: number;
  created_at: string;
}

export interface EventSimulation {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  input_parameters: {
    weights?: Record<string, number>;
    confidence?: number;
    baseline_score?: number;
  };
  predicted_output: {
    FusionScore: number;
    Confidence: number;
    Variance: number;
  };
  summary: string;
  created_at: string;
}

export interface EventOptimization {
  id: string;
  organization_id: string;
  user_id: string | null;
  optimization_type: 'auto_adjustment' | 'recommendation' | 'simulation_based';
  baseline_data: {
    weights: Record<string, number>;
    confidence: number;
    fusion_score: number;
    variance: number;
  };
  optimized_data: {
    weights: Record<string, number>;
    confidence: number;
    fusion_score: number;
    variance: number;
  };
  improvement_score: number;
  applied: boolean;
  applied_at: string | null;
  summary: string;
  created_at: string;
}
