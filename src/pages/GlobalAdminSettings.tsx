import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Shield, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle,
  UserPlus, Trash2, Loader2, X, Eye, EyeOff, Crown,
} from 'lucide-react'

interface UserEntry {
  id: string
  email: string
  full_name: string | null
  role: string
  is_global_admin: boolean
  created_at: string
  org_id: string | null
  org_name: string | null
  org_role: string | null
  tier: string | null
}

const TIER_OPTIONS = [
  { value: 'growth', label: 'Growth', color: 'bg-blue-100 text-blue-700', price: '$2,500/mo' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-purple-100 text-purple-700', price: '$5,000/mo' },
]

export default function GlobalAdminSettings() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create user form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newTier, setNewTier] = useState('growth')
  const [creating, setCreating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UserEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/.netlify/functions/admin-manage-users', {
        headers: { 'x-user-id': user?.id || '' },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load users')
        return
      }
      setUsers(data.users || [])
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) fetchUsers()
  }, [user?.id])

  async function toggleAdmin(targetUserId: string, grant: boolean) {
    setUpdating(targetUserId)
    setError(null)
    try {
      const res = await fetch('/.netlify/functions/manage-global-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: user?.id,
          target_user_id: targetUserId,
          is_global_admin: grant,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update')
        return
      }
      setUsers(prev =>
        prev.map(u => (u.id === targetUserId ? { ...u, is_global_admin: grant } : u))
      )
    } catch {
      setError('Failed to update access')
    } finally {
      setUpdating(null)
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/.netlify/functions/admin-manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          action: 'create-user',
          email: newEmail,
          password: newPassword,
          full_name: newFullName,
          tier: newTier,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create user')
        return
      }
      setSuccess(`User ${newEmail} created successfully (${newTier} tier)`)
      setNewEmail('')
      setNewPassword('')
      setNewFullName('')
      setNewTier('growth')
      setShowCreateForm(false)
      fetchUsers()
    } catch {
      setError('Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  async function deleteUser() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/.netlify/functions/admin-manage-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ user_id: deleteTarget.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete user')
        return
      }
      setSuccess(`User ${deleteTarget.email} deleted successfully`)
      setDeleteTarget(null)
      fetchUsers()
    } catch {
      setError('Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  async function updateTier(orgId: string, tier: string) {
    setError(null)
    try {
      const res = await fetch('/.netlify/functions/admin-manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ action: 'update-tier', org_id: orgId, tier }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update tier')
        return
      }
      setUsers(prev =>
        prev.map(u => (u.org_id === orgId ? { ...u, tier } : u))
      )
    } catch {
      setError('Failed to update tier')
    }
  }

  const globalAdminCount = users.filter(u => u.is_global_admin).length

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            User Management
          </h1>
          <p className="text-gray-500 mt-1">
            Create, manage, and assign tiers to platform users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Create User
          </button>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <UserPlus size={18} /> Create New User Account
            </h3>
            <button onClick={() => setShowCreateForm(false)} className="text-blue-400 hover:text-blue-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subscription Tier *</label>
                <select
                  value={newTier}
                  onChange={e => setNewTier(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {TIER_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label} — {t.price}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {creating ? 'Creating...' : 'Create Account'}
              </button>
              <span className="text-xs text-gray-500">
                Account will be active immediately with auto-confirmed email
              </span>
            </div>
          </form>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600"><X size={14} /></button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            All Users ({users.length}) · {globalAdminCount} global admin{globalAdminCount !== 1 ? 's' : ''}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-6 font-medium text-gray-600">User</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Tier</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Joined</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Admin</th>
                <th className="text-right py-3 px-6 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSelf = u.id === user?.id
                const isUpdating = updating === u.id
                const tierInfo = TIER_OPTIONS.find(t => t.value === u.tier)
                return (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">{u.full_name || '—'}</div>
                        {isSelf && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">You</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      {u.org_id ? (
                        <select
                          value={u.tier || 'growth'}
                          onChange={e => updateTier(u.org_id!, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${tierInfo?.color || 'bg-gray-100 text-gray-700'}`}
                        >
                          {TIER_OPTIONS.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">No org</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.is_global_admin ? (
                        <ShieldCheck className="h-5 w-5 text-green-600 inline" />
                      ) : (
                        <ShieldOff className="h-5 w-5 text-gray-300 inline" />
                      )}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.is_global_admin ? (
                          <button
                            onClick={() => toggleAdmin(u.id, false)}
                            disabled={isSelf || isUpdating}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title={isSelf ? 'Cannot remove your own access' : 'Revoke admin'}
                          >
                            {isUpdating ? '...' : 'Revoke Admin'}
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleAdmin(u.id, true)}
                            disabled={isUpdating}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors flex items-center gap-1"
                          >
                            <Crown size={10} />
                            {isUpdating ? '...' : 'Make Admin'}
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={10} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete User Account</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to permanently delete this user?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-3 text-sm">
              <div className="font-medium text-red-900">{deleteTarget.full_name || deleteTarget.email}</div>
              <div className="text-red-700 text-xs">{deleteTarget.email}</div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              This will remove their auth account, profile, and org membership. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteUser}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
