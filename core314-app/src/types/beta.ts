
export type BetaEventType = 'onboarding' | 'navigation' | 'action' | 'feature_usage' | 'system';

export type BetaEventName =
  | 'onboarding_start'
  | 'onboarding_completed'
  | 'dashboard_open'
  | 'fusion_engine_open'
  | 'decision_center_open'
  | 'system_monitor_open'
  | 'integration_hub_open'
  | 'session_start'
  | 'session_end';

export interface BetaEvent {
  event_type: BetaEventType;
  event_name: BetaEventName;
  metadata?: Record<string, unknown>;
}

export interface BetaUser {
  id: string;
  user_id: string;
  signup_at: string;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BetaEventRecord {
  id: string;
  user_id: string;
  event_type: string;
  event_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BetaFeatureUsage {
  id: string;
  user_id: string;
  feature_name: string;
  usage_count: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}
