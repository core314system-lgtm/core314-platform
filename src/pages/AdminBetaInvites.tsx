import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Send,
  RefreshCw,
  Copy,
  Check,
  Clock,
  UserCheck,
  XCircle,
  Mail,
  Plus,
  X,
  Ban,
  Trash2,
  RotateCcw,
  Search,
  ArrowUpDown,
  Download,
  StickyNote,
  MessageSquare,
  Activity,
  Calendar,
  FolderOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface TesterActivity {
  last_sign_in_at: string | null
  created_at: string
  project_count: number
  beta_start_date?: string | null
  beta_program_status?: string | null
  feedback_count?: number
}

interface BetaInvite {
  id: string
  email: string
  token: string
  status: 'pending' | 'applied' | 'accepted' | 'declined' | 'expired' | 'revoked'
  created_at: string
  claimed_at: string | null
  expires_at: string | null
  created_by: string | null
  notes: string | null
}

type SortField = 'email' | 'status' | 'created_at' | 'claimed_at'
type SortDir = 'asc' | 'desc'

export default function AdminBetaInvites() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<BetaInvite[]>([])
  const [testerActivity, setTesterActivity] = useState<Record<string, TesterActivity>>({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailList, setEmailList] = useState<string[]>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [seats, setSeats] = useState<{ total: number; accepted: number; remaining: number } | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'applied' | 'accepted' | 'declined' | 'expired' | 'revoked'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [followUpEmail, setFollowUpEmail] = useState<string | null>(null)
  const [followUpSubject, setFollowUpSubject] = useState('')
  const [followUpMessage, setFollowUpMessage] = useState('')
  const [sendingFollowUp, setSendingFollowUp] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'invitations' | 'feedback'>('invitations')
  const [allFeedback, setAllFeedback] = useState<Array<{ user_id: string; week_number: number; responses: Record<string, unknown>; submitted_at: string; user_email?: string; user_name?: string }>>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  async function fetchInvites() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        headers: { 'x-user-id': user?.id || '' },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load invitations')
        return
      }
      setInvites(data.invites || [])
      setTesterActivity(data.testerActivity || {})
      if (data.seats) setSeats(data.seats)
    } catch {
      setError('Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  async function fetchFeedback() {
    setFeedbackLoading(true)
    try {
      const res = await fetch('/.netlify/functions/beta-feedback?all=true', {
        headers: { 'x-user-id': user?.id || '' },
      })
      const data = await res.json()
      if (data.feedback) setAllFeedback(data.feedback)
    } catch { /* ignore */ }
    finally { setFeedbackLoading(false) }
  }

  useEffect(() => {
    if (user?.id) fetchInvites()
  }, [user?.id])

  useEffect(() => {
    if (activeTab === 'feedback' && allFeedback.length === 0 && user?.id) fetchFeedback()
  }, [activeTab, user?.id])

  function addEmail() {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) return
    const newEmails = trimmed.split(/[,;\s]+/).filter(e => {
      const emailRe = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      return emailRe.test(e) && !emailList.includes(e)
    })
    if (newEmails.length > 0) {
      setEmailList(prev => [...prev, ...newEmails])
      setEmailInput('')
    }
  }

  function removeEmail(email: string) {
    setEmailList(prev => prev.filter(e => e !== email))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addEmail()
    }
  }

  async function sendInvites() {
    if (emailList.length === 0) return
    setSending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: user?.id, emails: emailList }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to send invitations')
        return
      }
      const sent = data.sent || 0
      const skipped = data.results?.filter((r: { status: string }) => r.status === 'skipped').length || 0
      const failed = data.results?.filter((r: { status: string }) => r.status === 'failed').length || 0

      let msg = `${sent} invitation${sent !== 1 ? 's' : ''} sent`
      if (skipped > 0) msg += `, ${skipped} skipped (already invited)`
      if (failed > 0) msg += `, ${failed} failed`

      setSuccess(msg)
      setEmailList([])
      fetchInvites()
    } catch {
      setError('Failed to send invitations')
    } finally {
      setSending(false)
    }
  }

  async function resendInvite(inviteId: string) {
    setActionLoading(inviteId)
    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: user?.id, action: 'resend', invite_id: inviteId }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess('Invitation resent with new token')
        fetchInvites()
      } else {
        setError(data.error || 'Failed to resend')
      }
    } catch {
      setError('Failed to resend invitation')
    } finally {
      setActionLoading(null)
    }
  }

  async function revokeInvite(inviteId: string) {
    setActionLoading(inviteId)
    try {
      const res = await fetch(`/.netlify/functions/manage-beta-invites?id=${inviteId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      })
      if (res.ok) {
        setInvites(prev => prev.map(i => i.id === inviteId ? { ...i, status: 'revoked' as const } : i))
      }
    } catch {
      setError('Failed to revoke invitation')
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteInvite(inviteId: string) {
    setActionLoading(inviteId)
    try {
      const res = await fetch(`/.netlify/functions/manage-beta-invites?id=${inviteId}&action=delete`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      })
      if (res.ok) {
        setInvites(prev => prev.filter(i => i.id !== inviteId))
        setSelectedIds(prev => { const n = new Set(prev); n.delete(inviteId); return n })
      }
    } catch {
      setError('Failed to delete invitation')
    } finally {
      setActionLoading(null)
    }
  }

  async function acceptApplication(inviteId: string) {
    setActionLoading(inviteId)
    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: user?.id, action: 'accept', invite_id: inviteId }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess('Application accepted — welcome email sent!')
        fetchInvites()
      } else {
        setError(data.error || 'Failed to accept application')
      }
    } catch {
      setError('Failed to accept application')
    } finally {
      setActionLoading(null)
    }
  }

  async function declineApplication(inviteId: string) {
    if (!confirm('Decline this application? A capacity-full email will be sent.')) return
    setActionLoading(inviteId)
    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: user?.id, action: 'decline', invite_id: inviteId }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess('Application declined — notification sent.')
        fetchInvites()
      } else {
        setError(data.error || 'Failed to decline application')
      }
    } catch {
      setError('Failed to decline application')
    } finally {
      setActionLoading(null)
    }
  }

  async function saveNote(inviteId: string) {
    setActionLoading(inviteId)
    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: user?.id, action: 'update_notes', invite_id: inviteId, notes: noteText }),
      })
      if (res.ok) {
        setInvites(prev => prev.map(i => i.id === inviteId ? { ...i, notes: noteText || null } : i))
        setEditingNote(null)
        setNoteText('')
      }
    } catch {
      setError('Failed to save note')
    } finally {
      setActionLoading(null)
    }
  }

  async function sendFollowUp() {
    if (!followUpEmail || !followUpSubject || !followUpMessage) return
    setSendingFollowUp(true)
    try {
      const res = await fetch('/.netlify/functions/manage-beta-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: user?.id,
          action: 'follow_up',
          email: followUpEmail,
          subject: followUpSubject,
          message: followUpMessage,
        }),
      })
      if (res.ok) {
        setSuccess(`Follow-up email sent to ${followUpEmail}`)
        setFollowUpEmail(null)
        setFollowUpSubject('')
        setFollowUpMessage('')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to send follow-up')
      }
    } catch {
      setError('Failed to send follow-up email')
    } finally {
      setSendingFollowUp(false)
    }
  }

  async function bulkAction(action: 'revoke' | 'delete') {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setActionLoading('bulk')
    try {
      const res = await fetch(`/.netlify/functions/manage-beta-invites?id=bulk&ids=${ids.join(',')}&action=${action}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      })
      if (res.ok) {
        if (action === 'delete') {
          setInvites(prev => prev.filter(i => !selectedIds.has(i.id)))
        } else {
          setInvites(prev => prev.map(i => selectedIds.has(i.id) && i.status === 'pending' ? { ...i, status: 'revoked' as const } : i))
        }
        setSelectedIds(new Set())
        setSuccess(`${ids.length} invitation${ids.length !== 1 ? 's' : ''} ${action === 'delete' ? 'deleted' : 'revoked'}`)
      }
    } catch {
      setError(`Failed to ${action} invitations`)
    } finally {
      setActionLoading(null)
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/login?beta_invite=${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  function exportCSV() {
    const rows = [['Email', 'Status', 'Invited', 'Claimed', 'Expires', 'Notes', 'Days Since Signup', 'Projects', 'Last Active']]
    for (const inv of filteredAndSorted) {
      const activity = testerActivity[inv.email]
      const daysSince = inv.claimed_at ? Math.floor((Date.now() - new Date(inv.claimed_at).getTime()) / 86400000) : ''
      rows.push([
        inv.email,
        inv.status,
        new Date(inv.created_at).toLocaleDateString(),
        inv.claimed_at ? new Date(inv.claimed_at).toLocaleDateString() : '',
        inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '',
        inv.notes || '',
        String(daysSince),
        activity ? String(activity.project_count) : '',
        activity?.last_sign_in_at ? new Date(activity.last_sign_in_at).toLocaleDateString() : '',
      ])
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `beta-invitations-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredAndSorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(i => i.id)))
    }
  }

  function daysSince(dateStr: string | null): number | null {
    if (!dateStr) return null
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  }

  const counts = {
    all: invites.length,
    pending: invites.filter(i => i.status === 'pending').length,
    applied: invites.filter(i => i.status === 'applied').length,
    accepted: invites.filter(i => i.status === 'accepted').length,
    declined: invites.filter(i => i.status === 'declined').length,
    expired: invites.filter(i => i.status === 'expired').length,
    revoked: invites.filter(i => i.status === 'revoked').length,
  }

  const filteredAndSorted = useMemo(() => {
    let list = filter === 'all' ? invites : invites.filter(i => i.status === filter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(i => i.email.toLowerCase().includes(q) || (i.notes && i.notes.toLowerCase().includes(q)))
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'email') cmp = a.email.localeCompare(b.email)
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (sortField === 'claimed_at') cmp = (a.claimed_at ? new Date(a.claimed_at).getTime() : 0) - (b.claimed_at ? new Date(b.claimed_at).getTime() : 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [invites, filter, searchQuery, sortField, sortDir])

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />
      case 'accepted': return <UserCheck className="h-4 w-4 text-green-600" />
      case 'expired': return <XCircle className="h-4 w-4 text-gray-400" />
      case 'revoked': return <Ban className="h-4 w-4 text-red-400" />
      default: return null
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      applied: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      declined: 'bg-gray-100 text-gray-500',
      expired: 'bg-gray-100 text-gray-500',
      revoked: 'bg-red-100 text-red-600',
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
        {statusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field ? (
          sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" />
            Founding Partner Program
          </h1>
          <p className="text-gray-500 mt-1">
            Manage invitations, review applications, track tester activity, and communicate with partners
          </p>
          {seats && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700">{seats.accepted}/{seats.total} seats filled</span>
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(seats.accepted / seats.total) * 100}%` }} />
                </div>
                <span className="text-gray-500">{seats.remaining} remaining</span>
              </div>
            </div>
          )}
          <div className="mt-3 flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button onClick={() => setActiveTab('invitations')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'invitations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Invitations</button>
            <button onClick={() => setActiveTab('feedback')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'feedback' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Feedback Submissions</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={filteredAndSorted.length === 0}
            className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-50"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={fetchInvites}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {activeTab === 'feedback' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">All Feedback Submissions</h2>
              <p className="text-sm text-gray-500 mt-1">{allFeedback.length} total submissions across all testers</p>
            </div>
            <button
              onClick={fetchFeedback}
              disabled={feedbackLoading}
              className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${feedbackLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {feedbackLoading ? (
            <div className="p-12 text-center text-gray-500">Loading feedback...</div>
          ) : allFeedback.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No feedback submissions yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {allFeedback.map((fb, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Week {fb.week_number}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{fb.user_email || fb.user_id.slice(0, 8)}</span>
                      {fb.user_name && <span className="text-xs text-gray-500">({fb.user_name})</span>}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(fb.submitted_at).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {Object.entries(fb.responses).map(([key, val]) => (
                      <div key={key} className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500 font-medium">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-gray-800 mt-0.5">{Array.isArray(val) ? val.join(', ') : String(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'invitations' && <>
      {/* Send Invites Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-600" />
          Send Invitations
        </h2>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addEmail}
            placeholder="Enter email addresses (comma-separated)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={sending}
          />
          <button
            onClick={addEmail}
            disabled={!emailInput.trim() || sending}
            className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium text-gray-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {emailList.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {emailList.map(email => (
              <span key={email} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm">
                {email}
                <button onClick={() => removeEmail(email)} className="text-blue-400 hover:text-blue-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {emailList.length === 0 ? 'Add email addresses above, then click Send' : `${emailList.length} email${emailList.length !== 1 ? 's' : ''} ready to send`}
          </p>
          <button
            onClick={sendInvites}
            disabled={emailList.length === 0 || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="h-4 w-4" /> Send {emailList.length > 0 ? `${emailList.length} Invite${emailList.length !== 1 ? 's' : ''}` : 'Invites'}</>
            )}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 flex items-center gap-2">
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Follow-up Email Modal */}
      {followUpEmail && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            Send Follow-up to {followUpEmail}
          </h3>
          <input
            type="text"
            value={followUpSubject}
            onChange={e => setFollowUpSubject(e.target.value)}
            placeholder="Subject"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <textarea
            value={followUpMessage}
            onChange={e => setFollowUpMessage(e.target.value)}
            placeholder="Message..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setFollowUpEmail(null); setFollowUpSubject(''); setFollowUpMessage('') }}
              className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={sendFollowUp}
              disabled={!followUpSubject || !followUpMessage || sendingFollowUp}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sendingFollowUp ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending...</> : <><Send className="h-3.5 w-3.5" /> Send</>}
            </button>
          </div>
        </div>
      )}

      {/* Search + Filter + Bulk Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by email or notes..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'pending', 'applied', 'accepted', 'declined', 'expired', 'revoked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkAction('revoke')}
            disabled={actionLoading === 'bulk'}
            className="px-3 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-medium hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1"
          >
            <Ban className="h-3.5 w-3.5" /> Revoke
          </button>
          <button
            onClick={() => bulkAction('delete')}
            disabled={actionLoading === 'bulk'}
            className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-xs font-medium hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-600 hover:text-blue-800">Clear selection</button>
        </div>
      )}

      {/* Invitations Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            {filteredAndSorted.length} invitation{filteredAndSorted.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading invitations...</div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery ? `No invitations matching "${searchQuery}"` : filter === 'all' ? 'No invitations sent yet' : `No ${filter} invitations`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <SortHeader field="email" label="Email" />
                  <SortHeader field="status" label="Status" />
                  <SortHeader field="created_at" label="Invited" />
                  <SortHeader field="claimed_at" label="Claimed" />
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Activity</th>
                  <th className="text-right py-3 px-6 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map(invite => {
                  const activity = testerActivity[invite.email]
                  const days = daysSince(invite.claimed_at)
                  const isExpanded = expandedRow === invite.id

                  return (
                    <tr key={invite.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(invite.id)}
                          onChange={() => toggleSelect(invite.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-medium text-gray-900">{invite.email}</span>
                          {invite.notes && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <StickyNote className="h-3 w-3" />
                              {invite.notes.length > 40 ? invite.notes.slice(0, 40) + '...' : invite.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{statusBadge(invite.status)}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(invite.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {invite.claimed_at ? (
                          <div>
                            <span>{new Date(invite.claimed_at).toLocaleDateString()}</span>
                            {days !== null && (
                              <span className="text-xs text-gray-400 ml-1">({days}d ago)</span>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {invite.status === 'accepted' && activity ? (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-gray-500" title="Projects">
                              <FolderOpen className="h-3.5 w-3.5" /> {activity.project_count}
                            </span>
                            <span className="flex items-center gap-1 text-gray-500" title="Last active">
                              <Activity className="h-3.5 w-3.5" />
                              {activity.last_sign_in_at ? `${daysSince(activity.last_sign_in_at)}d` : 'Never'}
                            </span>
                          </div>
                        ) : invite.status === 'accepted' ? (
                          <span className="text-xs text-gray-400">No data yet</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Expand/collapse for details */}
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : invite.id)}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Details"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>

                          {/* Copy invite link (pending only) */}
                          {invite.status === 'pending' && (
                            <button
                              onClick={() => copyInviteLink(invite.token)}
                              className="text-gray-400 hover:text-blue-600 p-1"
                              title="Copy invite link"
                            >
                              {copiedToken === invite.token ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </button>
                          )}

                          {/* Resend (pending, expired, revoked) */}
                          {invite.status !== 'accepted' && (
                            <button
                              onClick={() => resendInvite(invite.id)}
                              disabled={actionLoading === invite.id}
                              className="text-gray-400 hover:text-blue-600 p-1 disabled:opacity-50"
                              title="Resend invitation"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          {/* Follow-up email (accepted only) */}
                          {invite.status === 'accepted' && (
                            <button
                              onClick={() => { setFollowUpEmail(invite.email); setFollowUpSubject('Procuvex Beta — Checking In'); setFollowUpMessage('') }}
                              className="text-gray-400 hover:text-blue-600 p-1"
                              title="Send follow-up email"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          )}

                          {/* Accept/Decline (applied only) */}
                          {invite.status === 'applied' && (
                            <>
                              <button
                                onClick={() => acceptApplication(invite.id)}
                                disabled={actionLoading === invite.id}
                                className="text-green-500 hover:text-green-700 p-1 disabled:opacity-50"
                                title="Accept application"
                              >
                                <UserCheck className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => declineApplication(invite.id)}
                                disabled={actionLoading === invite.id}
                                className="text-gray-400 hover:text-red-600 p-1 disabled:opacity-50"
                                title="Decline application"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}

                          {/* Revoke (pending only) */}
                          {invite.status === 'pending' && (
                            <button
                              onClick={() => revokeInvite(invite.id)}
                              disabled={actionLoading === invite.id}
                              className="text-gray-400 hover:text-red-600 p-1 disabled:opacity-50"
                              title="Revoke invitation"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete (any status) */}
                          <button
                            onClick={() => deleteInvite(invite.id)}
                            disabled={actionLoading === invite.id}
                            className="text-gray-400 hover:text-red-600 p-1 disabled:opacity-50"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>

                      {/* Expanded row details */}
                      {isExpanded && (
                        <>
                          {/* This is a hack — we need a second row for expanded content */}
                        </>
                      )}
                    </tr>
                  )
                })}

                {/* Expanded detail rows */}
                {filteredAndSorted.map(invite => {
                  if (expandedRow !== invite.id) return null
                  const activity = testerActivity[invite.email]

                  return (
                    <tr key={`${invite.id}-detail`} className="bg-gray-50/50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Details */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase">Details</h4>
                            <div className="text-xs space-y-1 text-gray-600">
                              <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Invited: {new Date(invite.created_at).toLocaleString()}</p>
                              {invite.claimed_at && <p className="flex items-center gap-1.5"><UserCheck className="h-3 w-3" /> Claimed: {new Date(invite.claimed_at).toLocaleString()}</p>}
                              {invite.expires_at && <p className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Expires: {new Date(invite.expires_at).toLocaleString()}</p>}
                            </div>
                          </div>

                          {/* Activity (accepted only) */}
                          {invite.status === 'accepted' && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase">Tester Activity</h4>
                              {activity ? (
                                <div className="text-xs space-y-1 text-gray-600">
                                  <p className="flex items-center gap-1.5"><FolderOpen className="h-3 w-3" /> Projects created: {activity.project_count}</p>
                                  <p className="flex items-center gap-1.5"><Activity className="h-3 w-3" /> Last active: {activity.last_sign_in_at ? new Date(activity.last_sign_in_at).toLocaleString() : 'Never logged in'}</p>
                                  <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Account created: {new Date(activity.created_at).toLocaleString()}</p>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">No activity data available</p>
                              )}
                            </div>
                          )}

                          {/* Notes */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                              <StickyNote className="h-3 w-3" /> Notes
                            </h4>
                            {editingNote === invite.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  placeholder="Add a note (e.g., referral source, vertical, feedback)..."
                                  rows={2}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => saveNote(invite.id)}
                                    disabled={actionLoading === invite.id}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => { setEditingNote(null); setNoteText('') }}
                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {invite.notes ? (
                                  <p className="text-xs text-gray-600 mb-1">{invite.notes}</p>
                                ) : (
                                  <p className="text-xs text-gray-400 mb-1">No notes</p>
                                )}
                                <button
                                  onClick={() => { setEditingNote(invite.id); setNoteText(invite.notes || '') }}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  {invite.notes ? 'Edit note' : 'Add note'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feedback Link Note */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-1">
          <MessageSquare className="h-4 w-4" />
          Beta Feedback Channel
        </h3>
        <p className="text-xs text-blue-700 leading-relaxed">
          Founding Partners submit weekly feedback via the <strong>Partner Feedback</strong> page in their sidebar. View all submissions in the "Feedback Submissions" tab above.
        </p>
      </div>
      </>}
    </div>
  )
}
