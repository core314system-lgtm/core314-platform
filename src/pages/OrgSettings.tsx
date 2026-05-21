import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import { useAuth } from '../contexts/AuthContext'
import { Settings, Users, UserPlus, Shield, Crown, Trash2, Check, Building2, Mail, Clock, X, RefreshCw } from 'lucide-react'
import type { OrgMember } from '../contexts/OrgContext'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full access. Can manage organization settings, members, and all data.',
  admin: 'Can manage members and all data. Cannot delete the organization.',
  member: 'Can create and edit projects, subcontractors, and run analysis.',
  viewer: 'Read-only access to all data.',
}

interface PendingInvite {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

export default function OrgSettings() {
  const { currentOrg, members, orgRole, refreshOrg, isMultiTenantEnabled } = useOrg()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<'general' | 'members'>('general')
  const [orgName, setOrgName] = useState(currentOrg?.name || '')
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [invitesSupported, setInvitesSupported] = useState(false)

  const loadInvites = useCallback(async () => {
    if (!currentOrg) return
    const { data, error } = await supabase
      .from('org_invitations')
      .select('id, email, role, status, created_at, expires_at')
      .eq('org_id', currentOrg.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!error) {
      setInvitesSupported(true)
      setPendingInvites(data || [])
    }
  }, [currentOrg])

  useEffect(() => {
    if (isMultiTenantEnabled && currentOrg) {
      loadInvites()
    }
  }, [isMultiTenantEnabled, currentOrg, loadInvites])

  if (!isMultiTenantEnabled) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings size={24} className="text-gray-600" /> Organization Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your organization and team</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Building2 className="mx-auto text-amber-500 mb-3" size={40} />
          <h3 className="font-semibold text-amber-900 mb-2">Multi-Tenant Not Yet Enabled</h3>
          <p className="text-sm text-amber-700 max-w-md mx-auto">
            Organization support requires a database migration. Contact your administrator to run the migration SQL to enable team management and organization features.
          </p>
        </div>
      </div>
    )
  }

  if (!currentOrg) {
    return <div className="text-center py-12 text-gray-500">Loading organization...</div>
  }

  const canManage = orgRole === 'owner' || orgRole === 'admin'

  async function handleSaveOrg() {
    if (!currentOrg || !canManage) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('organizations')
      .update({ name: orgName, updated_at: new Date().toISOString() })
      .eq('id', currentOrg.id)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Organization updated' })
      await refreshOrg()
    }
    setSaving(false)
  }

  async function handleInvite() {
    if (!currentOrg || !inviteEmail.trim() || !user) return
    setInviting(true)
    setMessage(null)

    try {
      const res = await fetch('/.netlify/functions/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          org_id: currentOrg.id,
          role: inviteRole,
          invited_by_id: user.id,
          invited_by_name: profile?.full_name || profile?.email || 'A team member',
          org_name: currentOrg.name,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setMessage({ type: 'error', text: data.error || 'Failed to send invitation' })
      } else {
        setMessage({ type: 'success', text: data.warning ? `Invitation created. ${data.warning}` : `Invitation sent to ${inviteEmail}` })
        setInviteEmail('')
        await loadInvites()
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send invitation. Please try again.' })
    }

    setInviting(false)
  }

  async function handleCancelInvite(invite: PendingInvite) {
    if (!confirm(`Cancel invitation for ${invite.email}?`)) return

    await supabase
      .from('org_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invite.id)

    await loadInvites()
    setMessage({ type: 'success', text: `Invitation for ${invite.email} cancelled` })
  }

  async function handleResendInvite(invite: PendingInvite) {
    if (!currentOrg || !user) return
    setMessage(null)

    // Cancel old invite
    await supabase
      .from('org_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invite.id)

    // Send a new one
    try {
      const res = await fetch('/.netlify/functions/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invite.email,
          org_id: currentOrg.id,
          role: invite.role,
          invited_by_id: user.id,
          invited_by_name: profile?.full_name || profile?.email || 'A team member',
          org_name: currentOrg.name,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setMessage({ type: 'error', text: data.error || 'Failed to resend invitation' })
      } else {
        setMessage({ type: 'success', text: `Invitation resent to ${invite.email}` })
        await loadInvites()
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to resend invitation.' })
    }
  }

  async function handleRemoveMember(member: OrgMember) {
    if (!canManage || member.role === 'owner') return
    if (!confirm(`Remove ${member.user_profile?.email || 'this user'} from the organization?`)) return

    await supabase.from('organization_members').delete().eq('id', member.id)
    await refreshOrg()
    setMessage({ type: 'success', text: `${member.user_profile?.email || 'Member'} removed from organization` })
  }

  async function handleChangeRole(member: OrgMember, newRole: string) {
    if (!canManage || member.role === 'owner') return
    await supabase.from('organization_members').update({ role: newRole }).eq('id', member.id)
    await refreshOrg()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings size={24} className="text-gray-600" /> Organization Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage {currentOrg.name}</p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-50 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('general')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings size={16} /> General
        </button>
        <button
          onClick={() => setTab('members')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'members' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} /> Team ({members.length})
        </button>
      </div>

      {tab === 'general' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
            <input
              type="text"
              value={currentOrg.slug}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Role</label>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                {orgRole === 'owner' && <Crown size={14} />}
                {orgRole === 'admin' && <Shield size={14} />}
                {ROLE_LABELS[orgRole || 'member']}
              </span>
              <span className="text-xs text-gray-500">{ROLE_DESCRIPTIONS[orgRole || 'member']}</span>
            </div>
          </div>

          {canManage && (
            <button
              onClick={handleSaveOrg}
              disabled={saving || orgName === currentOrg.name}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Check size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-4">
          {/* Invite Form */}
          {canManage && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-1">
                <Mail size={18} /> Invite Team Member
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {invitesSupported
                  ? 'Enter any email address. They\'ll receive an invitation to join your organization.'
                  : 'Enter the email of an existing Procuvex user to add them to your organization.'
                }
              </p>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
                >
                  <UserPlus size={15} /> {inviting ? 'Sending...' : 'Invite'}
                </button>
              </div>
            </div>
          )}

          {/* Pending Invitations */}
          {invitesSupported && pendingInvites.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-amber-500" /> Pending Invitations ({pendingInvites.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {pendingInvites.map(invite => (
                  <div key={invite.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{invite.email}</p>
                      <p className="text-xs text-gray-400">
                        Invited {new Date(invite.created_at).toLocaleDateString()} · Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {ROLE_LABELS[invite.role]} · Pending
                      </span>
                      {canManage && (
                        <>
                          <button
                            onClick={() => handleResendInvite(invite)}
                            className="text-blue-400 hover:text-blue-600 p-1"
                            title="Resend invitation"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            onClick={() => handleCancelInvite(invite)}
                            className="text-red-400 hover:text-red-600 p-1"
                            title="Cancel invitation"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Members List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 text-sm">Active Members ({members.length})</h3>
            </div>
            {members.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No members found</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {member.user_profile?.full_name || member.user_profile?.email || 'Unknown User'}
                        {member.user_id === user?.id && <span className="text-xs text-gray-400 ml-2">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-500">{member.user_profile?.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {canManage && member.role !== 'owner' && member.user_id !== user?.id ? (
                        <>
                          <select
                            value={member.role}
                            onChange={e => handleChangeRole(member, e.target.value)}
                            className="px-2 py-1 border border-gray-200 rounded text-sm"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="text-red-400 hover:text-red-600 p-1"
                            title="Remove member"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {member.role === 'owner' && <Crown size={12} />}
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
