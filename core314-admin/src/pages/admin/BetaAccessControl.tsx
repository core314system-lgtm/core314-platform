import { useEffect, useState } from 'react'
import { useSupabaseClient } from '../../contexts/SupabaseClientContext'
import { getSupabaseFunctionUrl } from '../../lib/supabaseRuntimeConfig'

interface User {
  id: string
  email: string
  full_name: string | null
  created_at: string
  beta_status: 'pending' | 'approved' | 'revoked'
  beta_approved_at: string | null
}

type FilterType = 'all' | 'pending' | 'approved' | 'revoked'

export default function BetaAccessControl() {
  const supabase = useSupabaseClient()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    applyFilter()
  }, [users, filter])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at, beta_status, beta_approved_at')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setUsers(data || [])
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = () => {
    if (filter === 'all') {
      setFilteredUsers(users)
    } else {
      setFilteredUsers(users.filter(user => user.beta_status === filter))
    }
  }

  const handleAction = async (userId: string, action: 'approve' | 'revoke' | 'reset') => {
    try {
      setActionLoading(userId)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const url = await getSupabaseFunctionUrl('beta-admin')
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action,
            userId
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Action failed')
      }

      const result = await response.json()
      console.log('Action result:', result)

      await fetchUsers()

      alert(`Successfully ${action}d user`)
    } catch (err: any) {
      console.error('Error performing action:', err)
      setError(err.message || 'Failed to perform action')
      alert(`Error: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      approved: 'bg-green-500/20 text-green-400 border-green-500/50',
      revoked: 'bg-red-500/20 text-red-400 border-red-500/50'
    }
    return styles[status as keyof typeof styles] || styles.pending
  }

  const getFilterButtonClass = (filterType: FilterType) => {
    const baseClass = 'px-4 py-2 rounded-lg font-medium transition-all'
    if (filter === filterType) {
      return `${baseClass} bg-gradient-to-r from-[#00BFFF] to-[#007BFF] text-white`
    }
    return `${baseClass} bg-[#2A3F5F] text-gray-300 hover:bg-[#3A4F6F]`
  }

  const stats = {
    total: users.length,
    pending: users.filter(u => u.beta_status === 'pending').length,
    approved: users.filter(u => u.beta_status === 'approved').length,
    revoked: users.filter(u => u.beta_status === 'revoked').length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F1A] via-[#1A1F2E] to-[#0A0F1A] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00BFFF] to-[#007BFF] mb-2">
            Beta Access Control
          </h1>
          <p className="text-gray-400">Manage user beta access approvals and revocations</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1A1F2E] border border-[#2A3F5F] rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">Total Users</div>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-[#1A1F2E] border border-yellow-500/30 rounded-lg p-6">
            <div className="text-yellow-400 text-sm mb-1">Pending</div>
            <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
          </div>
          <div className="bg-[#1A1F2E] border border-green-500/30 rounded-lg p-6">
            <div className="text-green-400 text-sm mb-1">Approved</div>
            <div className="text-3xl font-bold text-green-400">{stats.approved}</div>
          </div>
          <div className="bg-[#1A1F2E] border border-red-500/30 rounded-lg p-6">
            <div className="text-red-400 text-sm mb-1">Revoked</div>
            <div className="text-3xl font-bold text-red-400">{stats.revoked}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#1A1F2E] border border-[#2A3F5F] rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFilter('all')}
              className={getFilterButtonClass('all')}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={getFilterButtonClass('pending')}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={getFilterButtonClass('approved')}
            >
              Approved ({stats.approved})
            </button>
            <button
              onClick={() => setFilter('revoked')}
              className={getFilterButtonClass('revoked')}
            >
              Revoked ({stats.revoked})
            </button>
            <button
              onClick={fetchUsers}
              className="ml-auto px-4 py-2 bg-[#2A3F5F] text-gray-300 rounded-lg hover:bg-[#3A4F6F] transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-[#1A1F2E] border border-[#2A3F5F] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#00BFFF]"></div>
              <p className="mt-4">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p>No users found with filter: {filter}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0A0F1A] border-b border-[#2A3F5F]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Approved At
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3F5F]">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-[#0A0F1A]/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">
                          {user.full_name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(user.beta_status)}`}>
                          {user.beta_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-400">
                          {user.beta_approved_at 
                            ? new Date(user.beta_approved_at).toLocaleDateString()
                            : '-'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {user.beta_status !== 'approved' && (
                            <button
                              onClick={() => handleAction(user.id, 'approve')}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {actionLoading === user.id ? '...' : 'Approve'}
                            </button>
                          )}
                          {user.beta_status !== 'revoked' && (
                            <button
                              onClick={() => handleAction(user.id, 'revoke')}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {actionLoading === user.id ? '...' : 'Revoke'}
                            </button>
                          )}
                          {user.beta_status !== 'pending' && (
                            <button
                              onClick={() => handleAction(user.id, 'reset')}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {actionLoading === user.id ? '...' : 'Reset'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
