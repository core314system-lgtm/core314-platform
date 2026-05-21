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
      // Check if organizations table exists by trying to query it
      const { data: orgMembers, error } = await supabase
        .from('organization_members')
        .select('org_id, role, organizations(*)')
        .eq('user_id', user.id)

      if (error) {
        // Table doesn't exist yet — multi-tenant not enabled
        setIsMultiTenantEnabled(false)
        setLoading(false)
        return
      }

      setIsMultiTenantEnabled(true)

      if (!orgMembers || orgMembers.length === 0) {
        setLoading(false)
        return
      }

      const userOrgs = orgMembers
        .map(m => m.organizations as unknown as Organization)
        .filter(Boolean)

      setOrgs(userOrgs)

      // Determine current org
      const currentOrgId = profile?.current_org_id as string | undefined
      const activeOrg = currentOrgId
        ? userOrgs.find(o => o.id === currentOrgId) || userOrgs[0]
        : userOrgs[0]

      if (activeOrg) {
        setCurrentOrg(activeOrg)
        const membership = orgMembers.find(m => m.org_id === activeOrg.id)
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
    const { data } = await supabase
      .from('organization_members')
      .select('*, user_profile:user_profiles(email, full_name)')
      .eq('org_id', orgId)
      .order('joined_at')

    setMembers((data || []) as unknown as OrgMember[])
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
