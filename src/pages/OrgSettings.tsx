import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import { useAuth } from '../contexts/AuthContext'
import { Settings, Users, UserPlus, Shield, Crown, Trash2, Check, Building2 } from 'lucide-react'
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

export default function OrgSettings() {
  const { currentOrg, members, orgRole, refreshOrg, isMultiTenantEnabled } = useOrg()
  const { user } = useAuth()
  const [tab, setTab] = useState<'general' | 'members'>('general')
  const [orgName, setOrgName] = useState(currentOrg?.name || '')
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    if (!currentOrg || !inviteEmail.trim()) return
    setInviting(true)
    setMessage(null)

    // Check if user exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', inviteEmail.trim().toLowerCase())
      .single()

    if (!existingProfile) {
      setMessage({ type: 'error', text: 'No user found with that email. They must sign up first.' })
      setInviting(false)
      return
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', currentOrg.id)
      .eq('user_id', existingProfile.id)
      .single()

    if (existingMember) {
      setMessage({ type: 'error', text: 'This user is already a member of your organization.' })
      setInviting(false)
      return
    }

    const { error } = await supabase
      .from('organization_members')
      .insert({
        org_id: currentOrg.id,
        user_id: existingProfile.id,
        role: inviteRole,
        invited_by: user?.id,
      })

    if (error) {
      setMessage({ type: 'error', text: 'Failed to add member: ' + error.message })
    } else {
      setMessage({ type: 'success', text: `${inviteEmail} added as ${ROLE_LABELS[inviteRole]}` })
      setInviteEmail('')
      await refreshOrg()
    }
    setInviting(false)
  }

  async function handleRemoveMember(member: OrgMember) {
    if (!canManage || member.role === 'owner') return
    if (!confirm(`Remove ${member.user_profile?.email || 'this user'} from the organization?`)) return

    await supabase.from('organization_members').delete().eq('id', member.id)
    await refreshOrg()
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
        <div className={`rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
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
              <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                <UserPlus size={18} /> Add Team Member
              </h3>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="Email address (must have a Procuvex account)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {inviting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {member.user_profile?.full_name || member.user_profile?.email || 'Unknown User'}
                    {member.user_id === user?.id && <span className="text-xs text-gray-400 ml-2">(you)</span>}
                  </p>
                  <p className="text-sm text-gray-500">{member.user_profile?.email}</p>
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
        </div>
      )}
    </div>
  )
}
