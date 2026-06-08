import { useState, useEffect, useCallback } from 'react'
import { useOrgSafe } from '../contexts/OrgContext'
import { supabase } from '../lib/supabase'

export type TierPlan = 'growth' | 'enterprise' | 'none'
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

interface TierInfo {
  plan: TierPlan
  status: SubStatus
  loading: boolean
  canAccess: (feature: string) => boolean
  getLimit: (key: 'max_projects' | 'max_seats' | 'max_subcontractors' | 'max_connections_per_month') => number
  isEnterprise: boolean
  isGrowth: boolean
  hasActiveSubscription: boolean
  trialDaysLeft: number | null
  refresh: () => Promise<void>
}

export function useTier(): TierInfo {
  const orgCtx = useOrgSafe()
  const currentOrg = orgCtx?.currentOrg ?? null
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
        if (rawPlan.includes('enterprise')) {
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

  const hasActiveSubscription = status === 'active' || status === 'trialing'
  const isEnterprise = plan === 'enterprise' && hasActiveSubscription
  const isGrowth = plan === 'growth' && hasActiveSubscription

  const canAccess = useCallback((feature: string): boolean => {
    if (!hasActiveSubscription) return false
    if (isEnterprise) return true
    // Growth users can access everything except enterprise-only features
    return !ENTERPRISE_ONLY_FEATURES.has(feature)
  }, [hasActiveSubscription, isEnterprise])

  const getLimit = useCallback((key: 'max_projects' | 'max_seats' | 'max_subcontractors' | 'max_connections_per_month'): number => {
    if (isEnterprise) return ENTERPRISE_LIMITS[key]
    if (isGrowth) return GROWTH_LIMITS[key]
    return 0
  }, [isEnterprise, isGrowth])

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
    hasActiveSubscription,
    trialDaysLeft,
    refresh: loadTier,
  }
}
