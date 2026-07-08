import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOrgSafe } from '../contexts/OrgContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  resolvePlan,
  computeTierFlags,
  canAccessFeature,
  getTierLimit,
  trialDaysLeft as computeTrialDaysLeft,
  type TierPlan,
  type SubStatus,
  type TierLimitKey,
} from '../lib/tierLogic'

export type { TierPlan, SubStatus } from '../lib/tierLogic'

interface TierInfo {
  plan: TierPlan
  status: SubStatus
  loading: boolean
  canAccess: (feature: string) => boolean
  getLimit: (key: TierLimitKey) => number
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
        setPlan(resolvePlan(data.subscription_plan as string | null))
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

  const flags = useMemo(
    () => computeTierFlags({ plan, status, isGlobalAdmin }),
    [plan, status, isGlobalAdmin],
  )
  const { hasActiveSubscription, isAgentic, isEnterprise, isGrowth } = flags

  const canAccess = useCallback((feature: string): boolean => {
    return canAccessFeature(feature, { isGlobalAdmin, flags })
  }, [isGlobalAdmin, flags])

  const getLimit = useCallback((key: TierLimitKey): number => {
    return getTierLimit(key, { isGlobalAdmin, flags })
  }, [isGlobalAdmin, flags])

  const trialDaysLeft = computeTrialDaysLeft(trialEndsAt)

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
