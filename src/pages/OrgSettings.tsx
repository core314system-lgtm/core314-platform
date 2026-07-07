import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import { useAuth } from '../contexts/AuthContext'
import { Settings, Users, UserPlus, Shield, Crown, Trash2, Check, Building2, Mail, Clock, X, RefreshCw, FileText, Eye, EyeOff, LayoutTemplate, Bell } from 'lucide-react'
import OrgDefaultTemplate from '../components/OrgDefaultTemplate'
import NotificationPreferences from '../components/NotificationPreferences'
import SlackWebhookConfig from '../components/SlackWebhookConfig'
import TierGate from '../components/TierGate'
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

const DEFAULT_RFQ_TEMPLATE = `Dear {contact_name},

You are invited to submit a quote for the following scope of work:

**Project:** {task_order_title}
**Scope:** {sow_name}
**Site:** {site_name}, {location_city}, {location_state}
**Category:** {service_category}
**Response Due:** {due_date}

Please use the secure portal link below to review the full requirements, download all documents, submit your quote, and ask any questions.

This link is unique to your organization. Please do not share it.
If you have questions, you can submit them through the portal or reply to this email.

Regards,
{org_name}`

const TEMPLATE_VARIABLES = [
  { key: '{contact_name}', desc: 'Sub contact name or company' },
  { key: '{org_name}', desc: 'Your organization name' },
  { key: '{task_order_title}', desc: 'Project/task order title' },
  { key: '{sow_name}', desc: 'Scope of work name' },
  { key: '{service_category}', desc: 'Service category' },
  { key: '{site_name}', desc: 'Site name' },
  { key: '{location_city}', desc: 'City' },
  { key: '{location_state}', desc: 'State' },
  { key: '{due_date}', desc: 'Response due date' },
  { key: '{solicitation_number}', desc: 'Solicitation number' },
]

export default function OrgSettings() {
  const { currentOrg, members, orgRole, refreshOrg, isMultiTenantEnabled } = useOrg()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState<'general' | 'members' | 'rfq_template' | 'portal_form' | 'notifications'>('general')
  const [orgName, setOrgName] = useState(currentOrg?.name || '')
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [invitesSupported, setInvitesSupported] = useState(false)
  const [rfqTemplate, setRfqTemplate] = useState('')
  const [rfqTemplateLoaded, setRfqTemplateLoaded] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const loadRfqTemplate = useCallback(async () => {
    if (!currentOrg) return
    const { data } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', currentOrg.id)
      .single()

    const template = (data?.settings as any)?.rfq_template || ''
    setRfqTemplate(template)
    setRfqTemplateLoaded(true)
  }, [currentOrg])

  useEffect(() => {
    if (currentOrg?.name && !orgName) {
      setOrgName(currentOrg.name)
    }
  }, [currentOrg?.name])

  useEffect(() => {
    if (isMultiTenantEnabled && currentOrg && !rfqTemplateLoaded) {
      loadRfqTemplate()
    }
  }, [isMultiTenantEnabled, currentOrg, rfqTemplateLoaded, loadRfqTemplate])

  async function handleSaveRfqTemplate() {
    if (!currentOrg || !canManage) return
    setSavingTemplate(true)
    setMessage(null)

    const currentSettings = (currentOrg.settings || {}) as Record<string, unknown>
    const { error } = await supabase
      .from('organizations')
      .update({
        settings: { ...currentSettings, rfq_template: rfqTemplate },
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentOrg.id)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save template: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'RFQ template saved. It will be used for all future RFQ emails.' })
      await refreshOrg()
    }
    setSavingTemplate(false)
  }

  function getPreviewHtml() {
    const template = rfqTemplate || DEFAULT_RFQ_TEMPLATE
    return template
      .replace(/{contact_name}/g, 'John Smith')
      .replace(/{org_name}/g, currentOrg?.name || 'Your Company')
      .replace(/{task_order_title}/g, 'HVAC Maintenance Services')
      .replace(/{sow_name}/g, 'HVAC Preventive Maintenance')
      .replace(/{service_category}/g, 'HVAC')
      .replace(/{site_name}/g, 'Building 100')
      .replace(/{location_city}/g, 'Jacksonville')
      .replace(/{location_state}/g, 'FL')
      .replace(/{due_date}/g, 'June 30, 2026')
      .replace(/{solicitation_number}/g, 'W912DY-26-R-0042')
  }

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

    // Delete the invite rather than soft-update (avoids UNIQUE constraint issues)
    const { error } = await supabase
      .from('org_invitations')
      .delete()
      .eq('id', invite.id)

    if (error) {
      // Fallback: try update if delete policy isn't set
      const { error: updateErr } = await supabase
        .from('org_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invite.id)

      if (updateErr) {
        setMessage({ type: 'error', text: `Failed to cancel: ${updateErr.message}` })
        return
      }
    }

    // Remove from local state immediately
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id))
    setMessage({ type: 'success', text: `Invitation for ${invite.email} cancelled` })
  }

  async function handleResendInvite(invite: PendingInvite) {
    if (!currentOrg || !user) return
    setMessage(null)

    // Delete old invite
    await supabase
      .from('org_invitations')
      .delete()
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
        <button
          onClick={() => setTab('rfq_template')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'rfq_template' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText size={16} /> RFQ Template
        </button>
        <button
          onClick={() => setTab('portal_form')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'portal_form' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LayoutTemplate size={16} /> Portal Form
        </button>
        <button
          onClick={() => setTab('notifications')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'notifications' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell size={16} /> Notifications
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

      {tab === 'rfq_template' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Custom RFQ Email Language</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Customize the language used in RFQ emails sent to subcontractors. Leave blank to use the default template.
                </p>
              </div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPreview ? 'Hide Preview' : 'Preview'}
              </button>
            </div>

            {showPreview && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Preview (with sample data)</p>
                <div className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-white p-4 rounded border border-gray-200">
                  {getPreviewHtml()}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Template Body</label>
              <textarea
                value={rfqTemplate}
                onChange={e => setRfqTemplate(e.target.value)}
                placeholder={DEFAULT_RFQ_TEMPLATE}
                rows={14}
                disabled={!canManage}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-800 mb-2">Available Variables</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {TEMPLATE_VARIABLES.map(v => (
                  <div key={v.key} className="flex items-center gap-2 text-xs">
                    <code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">{v.key}</code>
                    <span className="text-gray-600">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {canManage && rfqTemplate && (
                  <button
                    onClick={() => { setRfqTemplate(''); setMessage(null) }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
              {canManage && (
                <button
                  onClick={handleSaveRfqTemplate}
                  disabled={savingTemplate}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Check size={16} /> {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> The portal link button and document attachments are always included in the email automatically, regardless of your template.
              Your custom text appears as the email body above the portal link.
            </p>
          </div>
        </div>
      )}

      {tab === 'portal_form' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <OrgDefaultTemplate />
        </div>
      )}

      {tab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <NotificationPreferences />
          </div>
          <TierGate feature="slack_integration" fallback={
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-500">Slack integration is available on the Enterprise plan.</p>
            </div>
          }>
            <SlackWebhookConfig orgId={currentOrg?.id || ''} isAdmin={canManage} />
          </TierGate>
        </div>
      )}
    </div>
  )
}
