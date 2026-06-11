import { useState, useEffect, useCallback } from 'react'
import { useOrgSafe } from '../contexts/OrgContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export type TierPlan = 'growth' | 'enterprise' | 'agentic' | 'none'
export type SubStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'no_subscription'

// Features gated to Enterprise only
const ENTERPRISE_ONLY_FEATURES = new Set([
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
])

// Agentic tier features — requires Agentic plan
const AGENTIC_ONLY_FEATURES = new Set([
  'agent_hub',
  'compliance_watchdog',
  'opportunity_hunter',
  'sub_recruitment_agent',
  'quote_analysis_agent',
  'agent_autonomous_mode',
])

// Growth tier limits
const GROWTH_LIMITS = {
  max_projects: 25,
  max_seats: 10,
  max_subcontractors: 500,
  max_connections_per_month: 25,
}

// Enterprise tier limits
const ENTERPRISE_LIMITS = {
  max_projects: Infinity,
  max_seats: Infinity,
  max_subcontractors: Infinity,
  max_connections_per_month: 100,
}

// Agentic tier limits (same as enterprise + agents)
const AGENTIC_LIMITS = {
  max_projects: Infinity,
  max_seats: Infinity,
  max_subcontractors: Infinity,
  max_connections_per_month: Infinity,
}

interface TierInfo {
  plan: TierPlan
  status: SubStatus
  loading: boolean
  canAccess: (feature: string) => boolean
  getLimit: (key: 'max_projects' | 'max_seats' | 'max_subcontractors' | 'max_connections_per_month') => number
  isEnterprise: boolean
  isGrowth: boolean
  isAgentic: boolean
  hasActiveSubscription: boolean
  trialDaysLeft: number | null
  refresh: () => Promise<void>
}

export function useTier(): TierInfo {
  const orgCtx = useOrgSafe()
  const { profile } = useAuth()
  const currentOrg = orgCtx?.currentOrg ?? null
  const isGlobalAdmin = profile?.is_global_admin === true
  const [plan, setPlan] = useState<TierPlan>('none')
  const [status, setStatus] = useState<SubStatus>('no_subscription')
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadTier = useCallback(async () => {
    if (!currentOrg?.id) {
      setLoading(false)
      return
    }

    try {
      const { data } = await supabase
        .from('organizations')
        .select('subscription_plan, subscription_status, trial_ends_at')
        .eq('id', currentOrg.id)
        .single()

      if (data) {
        const rawPlan = (data.subscription_plan || '') as string
        if (rawPlan.includes('agentic')) {
          setPlan('agentic')
        } else if (rawPlan.includes('enterprise')) {
          setPlan('enterprise')
        } else if (rawPlan.includes('growth')) {
          setPlan('growth')
        } else {
          setPlan('none')
        }
        setStatus((data.subscription_status || 'no_subscription') as SubStatus)
        setTrialEndsAt(data.trial_ends_at)
      }
    } catch {
      // Graceful fallback
    }
    setLoading(false)
  }, [currentOrg?.id])

  useEffect(() => {
    loadTier()
  }, [loadTier])

  const hasActiveSubscription = isGlobalAdmin || status === 'active' || status === 'trialing'
  const isAgentic = isGlobalAdmin || (plan === 'agentic' && hasActiveSubscription)
  const isEnterprise = isGlobalAdmin || ((plan === 'enterprise' || plan === 'agentic') && hasActiveSubscription)
  const isGrowth = plan === 'growth' && hasActiveSubscription

  const canAccess = useCallback((feature: string): boolean => {
    // Global admin bypasses all tier restrictions
    if (isGlobalAdmin) return true
    if (!hasActiveSubscription) return false
    if (isAgentic) return true
    if (isEnterprise) {
      // Enterprise can access everything except agentic-only features
      return !AGENTIC_ONLY_FEATURES.has(feature)
    }
    // Growth users can access everything except enterprise-only and agentic-only features
    return !ENTERPRISE_ONLY_FEATURES.has(feature) && !AGENTIC_ONLY_FEATURES.has(feature)
  }, [isGlobalAdmin, hasActiveSubscription, isEnterprise, isAgentic])

  const getLimit = useCallback((key: 'max_projects' | 'max_seats' | 'max_subcontractors' | 'max_connections_per_month'): number => {
    if (isGlobalAdmin) return Infinity
    if (isAgentic) return AGENTIC_LIMITS[key]
    if (isEnterprise) return ENTERPRISE_LIMITS[key]
    if (isGrowth) return GROWTH_LIMITS[key]
    return 0
  }, [isGlobalAdmin, isAgentic, isEnterprise, isGrowth])

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null

  return {
    plan,
    status,
    loading,
    canAccess,
    getLimit,
    isEnterprise,
    isGrowth,
    isAgentic,
    hasActiveSubscription,
    trialDaysLeft,
    refresh: loadTier,
  }
}
