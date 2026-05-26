import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Shield, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle } from 'lucide-react'

interface UserEntry {
  id: string
  email: string
  full_name: string | null
  role: string
  is_global_admin: boolean
  created_at: string
}

export default function GlobalAdminSettings() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/.netlify/functions/manage-global-admin', {
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

  const globalAdminCount = users.filter(u => u.is_global_admin).length

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Global Admin Access
          </h1>
          <p className="text-gray-500 mt-1">
            Manage who has system-wide administrator access to the platform
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Global admins have full platform access</p>
            <p className="mt-1">
              Global admins can view Beta Analytics, manage other global admins, and access all system-wide features.
              Only grant this to trusted team members.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">
            All Users ({users.length}) · {globalAdminCount} global admin{globalAdminCount !== 1 ? 's' : ''}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-6 font-medium text-gray-600">User</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Org Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Joined</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Global Admin</th>
                <th className="text-right py-3 px-6 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSelf = u.id === user?.id
                const isUpdating = updating === u.id
                return (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-6">
                      <div className="font-medium text-gray-900">{u.full_name || '—'}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
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
                      {u.is_global_admin ? (
                        <button
                          onClick={() => toggleAdmin(u.id, false)}
                          disabled={isSelf || isUpdating}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title={isSelf ? 'Cannot remove your own access' : 'Revoke global admin'}
                        >
                          {isUpdating ? 'Updating...' : 'Revoke'}
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleAdmin(u.id, true)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors"
                        >
                          {isUpdating ? 'Updating...' : 'Grant Access'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
