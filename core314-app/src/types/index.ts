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
