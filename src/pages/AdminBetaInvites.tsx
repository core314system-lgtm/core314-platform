import { useState, useEffect } from 'react'
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
} from 'lucide-react'

interface BetaInvite {
  id: string
  email: string
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  created_at: string
  claimed_at: string | null
  expires_at: string | null
  created_by: string | null
}

export default function AdminBetaInvites() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<BetaInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailList, setEmailList] = useState<string[]>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'expired' | 'revoked'>('all')

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
    } catch {
      setError('Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) fetchInvites()
  }, [user?.id])

  function addEmail() {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) return
    // Support comma/space-separated batch entry
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

  async function revokeInvite(inviteId: string) {
    setRevoking(inviteId)
    try {
      const res = await fetch(`/.netlify/functions/manage-beta-invites?id=${inviteId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      })
      if (res.ok) {
        setInvites(prev => prev.map(i => i.id === inviteId ? { ...i, status: 'revoked' } : i))
      }
    } catch {
      setError('Failed to revoke invitation')
    } finally {
      setRevoking(null)
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/login?beta_invite=${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const filteredInvites = filter === 'all' ? invites : invites.filter(i => i.status === filter)
  const counts = {
    all: invites.length,
    pending: invites.filter(i => i.status === 'pending').length,
    accepted: invites.filter(i => i.status === 'accepted').length,
    expired: invites.filter(i => i.status === 'expired').length,
    revoked: invites.filter(i => i.status === 'revoked').length,
  }

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
      accepted: 'bg-green-100 text-green-700',
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" />
            Beta Tester Invitations
          </h1>
          <p className="text-gray-500 mt-1">
            Invite beta testers and track their signup status
          </p>
        </div>
        <button
          onClick={fetchInvites}
          disabled={loading}
          className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

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
                <button
                  onClick={() => removeEmail(email)}
                  className="text-blue-400 hover:text-blue-600"
                >
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
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send {emailList.length > 0 ? `${emailList.length} Invite${emailList.length !== 1 ? 's' : ''}` : 'Invites'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {(['all', 'pending', 'accepted', 'expired', 'revoked'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Invitations Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">
            {filteredInvites.length} invitation{filteredInvites.length !== 1 ? 's' : ''}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading invitations...</div>
        ) : filteredInvites.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {filter === 'all' ? 'No invitations sent yet' : `No ${filter} invitations`}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-6 font-medium text-gray-600">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Invited</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Claimed</th>
                <th className="text-right py-3 px-6 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvites.map(invite => (
                <tr key={invite.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-6">
                    <span className="font-medium text-gray-900">{invite.email}</span>
                  </td>
                  <td className="py-3 px-4">{statusBadge(invite.status)}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(invite.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {invite.claimed_at ? new Date(invite.claimed_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {invite.status === 'pending' && (
                        <>
                          <button
                            onClick={() => copyInviteLink(invite.token)}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Copy invite link"
                          >
                            {copiedToken === invite.token ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => revokeInvite(invite.id)}
                            disabled={revoking === invite.id}
                            className="text-gray-400 hover:text-red-600 p-1 disabled:opacity-50"
                            title="Revoke invitation"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
