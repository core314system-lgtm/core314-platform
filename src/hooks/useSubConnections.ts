import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'
import { useTier } from './useTier'

interface SubConnectionsInfo {
  connectedSubIds: Set<string>
  connectionsUsedThisMonth: number
  connectionsLimit: number
  loading: boolean
  isConnected: (subId: string) => boolean
  connect: (subId: string) => Promise<{ success: boolean; error?: string }>
  canConnect: boolean
  refresh: () => Promise<void>
}

const CONNECTION_LIMITS: Record<string, number> = {
  growth: 25,
  enterprise: 100,
}

export function useSubConnections(): SubConnectionsInfo {
  const { user, profile } = useAuth()
  const { currentOrg } = useOrg()
  const { plan, isEnterprise, isGrowth } = useTier()
  const [connectedSubIds, setConnectedSubIds] = useState<Set<string>>(new Set())
  const [connectionsUsedThisMonth, setConnectionsUsedThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.is_global_admin === true
  const connectionsLimit = isAdmin ? Infinity : (CONNECTION_LIMITS[plan] || 0)

  const loadConnections = useCallback(async () => {
    if (!currentOrg?.id) {
      setLoading(false)
      return
    }

    try {
      // Fetch all connections for this org
      const { data: connections } = await supabase
        .from('sub_connections')
        .select('sub_id, created_at')
        .eq('org_id', currentOrg.id)

      if (connections) {
        setConnectedSubIds(new Set(connections.map(c => c.sub_id)))

        // Count connections created this calendar month
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const thisMonthCount = connections.filter(c => c.created_at >= monthStart).length
        setConnectionsUsedThisMonth(thisMonthCount)
      }
    } catch {
      // Graceful fallback — table might not exist yet
    }
    setLoading(false)
  }, [currentOrg?.id])

  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  const isConnected = useCallback((subId: string): boolean => {
    if (isAdmin) return true
    return connectedSubIds.has(subId)
  }, [connectedSubIds, isAdmin])

  const canConnect = isAdmin || connectionsUsedThisMonth < connectionsLimit

  const connect = useCallback(async (subId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || !currentOrg?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    if (isAdmin || connectedSubIds.has(subId)) {
      return { success: true }
    }

    if (connectionsUsedThisMonth >= connectionsLimit) {
      return {
        success: false,
        error: `Monthly connection limit reached (${connectionsLimit}). Upgrade your plan for more connections.`,
      }
    }

    try {
      const { error } = await supabase.from('sub_connections').insert({
        user_id: user.id,
        org_id: currentOrg.id,
        sub_id: subId,
      })

      if (error) {
        if (error.code === '23505') {
          // Already connected (unique constraint)
          setConnectedSubIds(prev => new Set([...prev, subId]))
          return { success: true }
        }
        return { success: false, error: error.message }
      }

      setConnectedSubIds(prev => new Set([...prev, subId]))
      setConnectionsUsedThisMonth(prev => prev + 1)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection failed' }
    }
  }, [user, currentOrg?.id, isAdmin, connectedSubIds, connectionsUsedThisMonth, connectionsLimit])

  return {
    connectedSubIds,
    connectionsUsedThisMonth,
    connectionsLimit,
    loading,
    isConnected,
    connect,
    canConnect,
    refresh: loadConnections,
  }
}
