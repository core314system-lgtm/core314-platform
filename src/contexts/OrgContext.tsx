import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: Record<string, unknown>
  created_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
  user_profile?: {
    email: string
    full_name: string | null
  }
}

interface OrgContextType {
  currentOrg: Organization | null
  orgs: Organization[]
  members: OrgMember[]
  orgRole: string | null
  loading: boolean
  switchOrg: (orgId: string) => Promise<void>
  refreshOrg: () => Promise<void>
  isMultiTenantEnabled: boolean
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [orgRole, setOrgRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMultiTenantEnabled, setIsMultiTenantEnabled] = useState(false)

  const loadOrgs = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // Step 1: Check if organizations table exists with a simple query
      const { error: tableCheck } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)

      if (tableCheck) {
        // Table doesn't exist yet — multi-tenant not enabled
        setIsMultiTenantEnabled(false)
        setLoading(false)
        return
      }

      setIsMultiTenantEnabled(true)

      // Step 2: Get user's memberships (simple query, no join)
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('org_id, role')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) {
        setLoading(false)
        return
      }

      // Step 3: Fetch the org details separately (avoids PostgREST join issues)
      const orgIds = memberships.map(m => m.org_id)
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)

      const userOrgs = (orgData || []) as Organization[]
      setOrgs(userOrgs)

      // Determine current org
      const currentOrgId = profile?.current_org_id as string | undefined
      const activeOrg = currentOrgId
        ? userOrgs.find(o => o.id === currentOrgId) || userOrgs[0]
        : userOrgs[0]

      if (activeOrg) {
        setCurrentOrg(activeOrg)
        const membership = memberships.find(m => m.org_id === activeOrg.id)
        setOrgRole(membership?.role || null)
        await loadMembers(activeOrg.id)
      }
    } catch {
      // Graceful fallback — org tables may not exist
      setIsMultiTenantEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [user, profile])

  async function loadMembers(orgId: string) {
    // Step 1: Get memberships (no join — avoids PostgREST relationship issues)
    const { data: rawMembers } = await supabase
      .from('organization_members')
      .select('id, org_id, user_id, role, joined_at')
      .eq('org_id', orgId)
      .order('joined_at')

    if (!rawMembers || rawMembers.length === 0) {
      setMembers([])
      return
    }

    // Step 2: Get profiles for those users
    const userIds = rawMembers.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .in('id', userIds)

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    // Step 3: Merge
    const merged = rawMembers.map(m => ({
      ...m,
      user_profile: profileMap.get(m.user_id) || undefined,
    }))

    setMembers(merged as OrgMember[])
  }

  async function switchOrg(orgId: string) {
    const org = orgs.find(o => o.id === orgId)
    if (!org || !user) return

    setCurrentOrg(org)
    await supabase.from('user_profiles').update({ current_org_id: orgId }).eq('id', user.id)
    await loadMembers(orgId)
  }

  async function refreshOrg() {
    await loadOrgs()
  }

  useEffect(() => {
    loadOrgs()
  }, [loadOrgs])

  return (
    <OrgContext.Provider value={{
      currentOrg,
      orgs,
      members,
      orgRole,
      loading,
      switchOrg,
      refreshOrg,
      isMultiTenantEnabled,
    }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (context === undefined) {
    throw new Error('useOrg must be used within an OrgProvider')
  }
  return context
}

/** Safe version that returns null when used outside OrgProvider (e.g. public pages) */
export function useOrgSafe(): OrgContextType | null {
  return useContext(OrgContext) ?? null
}
