// ========== Agentic AI Foundation Types ==========

export type AgentType =
  | 'compliance_watchdog'
  | 'opportunity_hunter'
  | 'sub_recruitment'
  | 'quote_analysis'

export type AutonomyLevel = 'advisor' | 'supervised' | 'autonomous'

export type AgentActionStatus = 'pending_approval' | 'approved' | 'executed' | 'rejected' | 'expired'

export type AgentActionType =
  | 'alert'
  | 'recommend_sub'
  | 'send_email'
  | 'score_opportunity'
  | 'analyze_quote'
  | 'flag_compliance'

export type ProjectRole = 'pm' | 'estimator' | 'bd' | 'viewer'

export const AGENT_META: Record<AgentType, { label: string; description: string; icon: string; defaultLevel: AutonomyLevel; riskTier: 'low' | 'medium' | 'high' }> = {
  compliance_watchdog: {
    label: 'Compliance Watchdog',
    description: 'Monitors certifications, SAM registration, insurance, and bonding expiry across your subcontractor network.',
    icon: 'Shield',
    defaultLevel: 'advisor',
    riskTier: 'low',
  },
  opportunity_hunter: {
    label: 'Opportunity Hunter',
    description: 'Scans SAM.gov for matching opportunities, scores against your capabilities, and delivers pre-analyzed briefs.',
    icon: 'Radar',
    defaultLevel: 'advisor',
    riskTier: 'low',
  },
  sub_recruitment: {
    label: 'Sub Recruitment',
    description: 'Identifies capability gaps on projects and finds, ranks, and contacts potential subcontractors to fill them.',
    icon: 'UserPlus',
    defaultLevel: 'advisor',
    riskTier: 'medium',
  },
  quote_analysis: {
    label: 'Quote Analysis',
    description: 'Compares submitted quotes against market data, identifies above/below-market line items, and suggests negotiation points.',
    icon: 'TrendingUp',
    defaultLevel: 'advisor',
    riskTier: 'medium',
  },
}

export const AUTONOMY_LEVELS: Record<AutonomyLevel, { label: string; description: string; color: string }> = {
  advisor: {
    label: 'Advisor',
    description: 'Agent recommends — you approve before any action is taken.',
    color: 'blue',
  },
  supervised: {
    label: 'Supervised',
    description: 'Agent acts, but you get notified and can override within a window.',
    color: 'amber',
  },
  autonomous: {
    label: 'Autonomous',
    description: 'Agent acts independently. You get a daily summary.',
    color: 'green',
  },
}

export const PROJECT_ROLES: Record<ProjectRole, { label: string; description: string; color: string }> = {
  pm: {
    label: 'Project Manager',
    description: 'Manages team, approves agent actions, owns the project.',
    color: 'blue',
  },
  estimator: {
    label: 'Estimator',
    description: 'Handles pricing, quotes, and cost analysis.',
    color: 'green',
  },
  bd: {
    label: 'Business Development',
    description: 'Opportunity pursuit, teaming, and capture.',
    color: 'purple',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to project data.',
    color: 'gray',
  },
}

export interface AgentSetting {
  id: string
  org_id: string
  project_id: string | null
  agent_type: AgentType
  autonomy_level: AutonomyLevel
  enabled: boolean
  primary_contact_id: string | null
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentAction {
  id: string
  org_id: string
  project_id: string | null
  agent_type: AgentType
  action_type: AgentActionType
  status: AgentActionStatus
  title: string
  description: string
  payload: Record<string, unknown>
  context: Record<string, unknown>
  assigned_to: string | null
  created_at: string
  approved_at: string | null
  executed_at: string | null
  expires_at: string | null
  resolved_by: string | null
}

export interface ProjectTeamMember {
  id: string
  task_order_id: string
  user_id: string
  role: ProjectRole
  is_primary_contact: boolean
  assigned_at: string
  assigned_by: string | null
  user_name?: string
  user_email?: string
}

export interface NotificationPreference {
  id: string
  user_id: string
  org_id: string
  project_id: string | null
  agent_type: AgentType | 'all'
  channel: 'email' | 'in_app' | 'both'
  enabled: boolean
}
