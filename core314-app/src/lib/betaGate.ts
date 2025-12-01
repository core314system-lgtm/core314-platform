import { redirect } from 'react-router-dom'
import { supabase } from './supabase'

export interface BetaGateResult {
  betaStatus: string
  profile: any
}

/**
 * Beta Access Gate Loader
 * Checks user's beta_status and redirects if not approved
 * Use this as a loader for all protected routes
 */
export async function betaGateLoader(): Promise<BetaGateResult | Response> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      console.error('[BETA-GATE] No session found:', sessionError)
      return redirect('/login')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, beta_status, beta_approved_at')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      console.error('[BETA-GATE] Failed to fetch profile:', profileError)
      return redirect('/beta-pending')
    }

    const betaStatus = profile?.beta_status || 'pending'

    console.log(`[BETA-GATE] User ${session.user.email} has beta_status: ${betaStatus}`)

    switch (betaStatus) {
      case 'pending':
        return redirect('/beta-pending')
      
      case 'revoked':
        return redirect('/beta-revoked')
      
      case 'approved':
        return { betaStatus, profile }
      
      default:
        console.warn('[BETA-GATE] Unknown beta_status:', betaStatus)
        return redirect('/beta-pending')
    }
  } catch (error) {
    console.error('[BETA-GATE] Unexpected error:', error)
    return redirect('/beta-pending')
  }
}

/**
 * Hook to check beta status in real-time (optional enhancement)
 * Can be used in protected layouts to handle status changes while user is logged in
 */
export function useBetaStatusMonitor() {
  const [betaStatus, setBetaStatus] = React.useState<string | null>(null)

  React.useEffect(() => {
    let subscription: any

    async function setupMonitor() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      subscription = supabase
        .channel('beta-status-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${session.user.id}`
          },
          (payload) => {
            const newStatus = payload.new.beta_status
            console.log('[BETA-MONITOR] Status changed to:', newStatus)
            setBetaStatus(newStatus)
            
            if (newStatus === 'pending') {
              window.location.href = '/beta-pending'
            } else if (newStatus === 'revoked') {
              window.location.href = '/beta-revoked'
            }
          }
        )
        .subscribe()
    }

    setupMonitor()

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  return betaStatus
}

import React from 'react'
