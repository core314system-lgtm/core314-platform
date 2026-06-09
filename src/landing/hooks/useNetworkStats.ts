import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export interface NetworkStats {
  total: number
  contactable: number
  smallBusiness: number
  verified: number
  statesCovered: number
  tradeCategories: number
  loading: boolean
}

const CACHE_KEY = 'procuvex_network_stats'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CachedStats {
  data: Omit<NetworkStats, 'loading'>
  timestamp: number
}

function getCached(): Omit<NetworkStats, 'loading'> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedStats = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL) return null
    return cached.data
  } catch {
    return null
  }
}

function setCache(data: Omit<NetworkStats, 'loading'>) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* ignore */ }
}

export function useNetworkStats(): NetworkStats {
  const cached = getCached()
  const [stats, setStats] = useState<NetworkStats>({
    total: cached?.total ?? 0,
    contactable: cached?.contactable ?? 0,
    smallBusiness: cached?.smallBusiness ?? 0,
    verified: cached?.verified ?? 0,
    statesCovered: cached?.statesCovered ?? 50,
    tradeCategories: cached?.tradeCategories ?? 45,
    loading: !cached,
  })

  useEffect(() => {
    if (cached) return // already have fresh data

    async function fetchStats() {
      try {
        const [totalRes, emailRes, smallBizRes, verifiedRes] = await Promise.all([
          supabase.from('master_subcontractors').select('*', { count: 'exact', head: true }),
          supabase.from('master_subcontractors').select('*', { count: 'exact', head: true }).not('contact_email', 'is', null),
          supabase.from('master_subcontractors').select('*', { count: 'exact', head: true }).eq('small_business', true),
          supabase.from('master_subcontractors').select('*', { count: 'exact', head: true }).in('verification_status', ['verified', 'claimed']),
        ])

        const data = {
          total: totalRes.count || 0,
          contactable: emailRes.count || 0,
          smallBusiness: smallBizRes.count || 0,
          verified: verifiedRes.count || 0,
          statesCovered: 50,
          tradeCategories: 45,
        }

        setCache(data)
        setStats({ ...data, loading: false })
      } catch (err) {
        console.error('Failed to fetch network stats:', err)
        setStats(prev => ({ ...prev, loading: false }))
      }
    }

    fetchStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return stats
}
