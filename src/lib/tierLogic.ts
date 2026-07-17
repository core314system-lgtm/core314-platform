/**
 * Pure tier / subscription gating logic.
 *
 * Extracted from useTier so it can be unit-tested without React or Supabase.
 * The useTier hook is a thin wrapper that feeds live org data into these functions.
 */

export type TierPlan = 'growth' | 'enterprise' | 'agentic' | 'none'
export type SubStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'no_subscription'

export type TierLimitKey = 'max_projects' | 'max_seats' | 'max_subcontractors' | 'max_connections_per_month'

// Features gated to Enterprise only
export const ENTERPRISE_ONLY_FEATURES = new Set<string>([
  'post_award',
  'teaming_jv',
  'resource_capacity',
  'relationship_intelligence',
  'custom_quote_forms',
  'api_access',
  'custom_workflows',
  'intelligence_library',
  'vendor_performance_scoring',
  'dedicated_onboarding',
  'sla_guarantee',
  'agent_hub',
  'compliance_watchdog',
  'opportunity_hunter',
  'sub_recruitment_agent',
  'quote_analysis_agent',
  'agent_autonomous_mode',
  'contacts_crm',
  'project_contacts',
  'task_assignments',
  'activity_feed',
  'slack_integration',
  'weekly_digest',
  'proposal_draft_generation',
  'saml_sso',
  'custom_email_domain',
])

export const GROWTH_LIMITS: Record<TierLimitKey, number> = {
  max_projects: 25,
  max_seats: 10,
  max_subcontractors: 500,
  max_connections_per_month: 25,
}

export const ENTERPRISE_LIMITS: Record<TierLimitKey, number> = {
  max_projects: Infinity,
  max_seats: Infinity,
  max_subcontractors: Infinity,
  max_connections_per_month: 100,
}

export const AGENTIC_LIMITS: Record<TierLimitKey, number> = {
  max_projects: Infinity,
  max_seats: Infinity,
  max_subcontractors: Infinity,
  max_connections_per_month: Infinity,
}

/** Normalize a raw subscription_plan string into a canonical TierPlan. */
export function resolvePlan(rawPlan: string | null | undefined): TierPlan {
  const plan = rawPlan || ''
  if (plan.includes('agentic')) return 'agentic'
  if (plan.includes('enterprise')) return 'enterprise'
  if (plan.includes('growth')) return 'growth'
  return 'none'
}

export interface TierFlags {
  hasActiveSubscription: boolean
  isAgentic: boolean
  isEnterprise: boolean
  isGrowth: boolean
}

/** Derive access flags from plan + status + admin state. */
export function computeTierFlags(params: {
  plan: TierPlan
  status: SubStatus
  isGlobalAdmin: boolean
}): TierFlags {
  const { plan, status, isGlobalAdmin } = params
  const hasActiveSubscription = isGlobalAdmin || status === 'active' || status === 'trialing'
  const isAgentic = isGlobalAdmin || (plan === 'agentic' && hasActiveSubscription)
  const isEnterprise = isGlobalAdmin || ((plan === 'enterprise' || plan === 'agentic') && hasActiveSubscription)
  const isGrowth = plan === 'growth' && hasActiveSubscription
  return { hasActiveSubscription, isAgentic, isEnterprise, isGrowth }
}

/** Whether a feature is accessible given tier flags. */
export function canAccessFeature(feature: string, params: {
  isGlobalAdmin: boolean
  flags: TierFlags
}): boolean {
  const { isGlobalAdmin, flags } = params
  if (isGlobalAdmin) return true
  if (!flags.hasActiveSubscription) return false
  if (flags.isAgentic) return true
  if (flags.isEnterprise) return true
  return !ENTERPRISE_ONLY_FEATURES.has(feature)
}

/** Resolve a numeric limit for the given tier flags. */
export function getTierLimit(key: TierLimitKey, params: {
  isGlobalAdmin: boolean
  flags: TierFlags
}): number {
  const { isGlobalAdmin, flags } = params
  if (isGlobalAdmin) return Infinity
  if (flags.isAgentic) return AGENTIC_LIMITS[key]
  if (flags.isEnterprise) return ENTERPRISE_LIMITS[key]
  if (flags.isGrowth) return GROWTH_LIMITS[key]
  return 0
}

/** Days remaining in trial, or null if no trial end date. */
export function trialDaysLeft(trialEndsAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!trialEndsAt) return null
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / 86400000))
}
