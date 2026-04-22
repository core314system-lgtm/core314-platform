import { useEffect, useState } from 'react'
import { useSupabaseClient } from '../../contexts/SupabaseClientContext'
import { getSupabaseFunctionUrl } from '../../lib/supabaseRuntimeConfig'

interface BetaApplication {
  id: string
  full_name: string
  email: string
  role_title: string
  company_size: string
  tools_systems_used: string
  biggest_challenge: string
  why_beta_test: string
  status: 'pending' | 'approved' | 'rejected' | 'waitlisted'
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

type FilterType = 'all' | 'pending' | 'approved' | 'rejected' | 'waitlisted'

export default function BetaAccessControl() {
  const supabase = useSupabaseClient()
  const [applications, setApplications] = useState<BetaApplication[]>([])
  const [filteredApplications, setFilteredApplications] = useState<BetaApplication[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchApplications()
  }, [])

  useEffect(() => {
    applyFilter()
  }, [applications, filter])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('beta_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setApplications(data || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch applications'
      console.error('Error fetching applications:', err)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = () => {
    if (filter === 'all') {
      setFilteredApplications(applications)
    } else {
      setFilteredApplications(applications.filter(app => app.status === filter))
    }
  }

  const handleAction = async (applicationId: string, action: 'approve' | 'reject' | 'waitlist') => {
    try {
      setActionLoading(applicationId)
      setError(null)

      const rpcName = action === 'approve'
        ? 'approve_beta_application'
        : action === 'reject'
          ? 'reject_beta_application'
          : 'waitlist_beta_application'

      const { data, error: rpcError } = await supabase.rpc(rpcName, {
        application_id: applicationId,
      })

      if (rpcError) throw rpcError

      if (!data) {
        throw new Error('Application may have already been processed')
      }

      // On approval, trigger the full workflow: email + invite + lifecycle
      if (action === 'approve') {
        await triggerApprovalWorkflow(applicationId)
      }

      await fetchApplications()

      const label = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'waitlisted'
      alert(`Successfully ${label} application`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to perform action'
      console.error('Error performing action:', err)
      setError(message)
      alert(`Error: ${message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevoke = async (applicationId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to revoke this approval? The beta spot will be freed up and any lifecycle tracking will be removed.'
    )
    if (!confirmed) return

    try {
      setActionLoading(applicationId)
      setError(null)

      const { data, error: rpcError } = await supabase.rpc('revoke_beta_application', {
        application_id: applicationId,
        notes: 'Approval revoked by admin',
      })

      if (rpcError) throw rpcError

      if (!data) {
        throw new Error('Application may have already been processed')
      }

      await fetchApplications()
      alert('Approval revoked successfully. Beta spot has been freed.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke approval'
      console.error('Error revoking approval:', err)
      setError(message)
      alert(`Error: ${message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const triggerApprovalWorkflow = async (applicationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.warn('No session available for approval workflow')
        return
      }

      const url = await getSupabaseFunctionUrl('beta-approve-notify')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ application_id: applicationId }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.warn('Approval workflow returned error:', result.error)
        return
      }

      console.log('Approval workflow results:', result)

      // Show detailed results to admin
      const details: string[] = []
      if (result.email_sent) details.push('Approval email sent')
      if (result.email_error) details.push(`Email failed: ${result.email_error}`)
      if (result.invite_sent) details.push('Account invite sent')
      if (result.invite_error) details.push(`Invite failed: ${result.invite_error}`)
      if (result.lifecycle_created) details.push('Lifecycle tracking created')
      if (result.lifecycle_error) details.push(`Lifecycle failed: ${result.lifecycle_error}`)

      if (details.length > 0) {
        alert(`Approval workflow:\n${details.join('\n')}`)
      }
    } catch (err) {
      console.warn('Approval workflow failed (non-blocking):', err)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      approved: 'bg-green-500/20 text-green-400 border-green-500/50',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/50',
      waitlisted: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    }
    return styles[status] || styles.pending
  }

  const getFilterButtonClass = (filterType: FilterType) => {
    const baseClass = 'px-4 py-2 rounded-lg font-medium transition-all'
    if (filter === filterType) {
      return `${baseClass} bg-gradient-to-r from-[#00BFFF] to-[#007BFF] text-white`
    }
    return `${baseClass} bg-[#2A3F5F] text-gray-300 hover:bg-[#3A4F6F]`
  }

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    waitlisted: applications.filter(a => a.status === 'waitlisted').length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F1A] via-[#1A1F2E] to-[#0A0F1A] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00BFFF] to-[#007BFF] mb-2">
            Beta Access Control
          </h1>
          <p className="text-gray-400">Review and manage beta tester applications from core314.com/beta</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#1A1F2E] border border-[#2A3F5F] rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-1">Total</div>
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
            <div className="text-red-400 text-sm mb-1">Rejected</div>
            <div className="text-3xl font-bold text-red-400">{stats.rejected}</div>
          </div>
          <div className="bg-[#1A1F2E] border border-blue-500/30 rounded-lg p-6">
            <div className="text-blue-400 text-sm mb-1">Waitlisted</div>
            <div className="text-3xl font-bold text-blue-400">{stats.waitlisted}</div>
          </div>
        </div>

        {/* Spots remaining */}
        <div className="bg-[#1A1F2E] border border-[#2A3F5F] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">
              Beta spots: <span className="text-white font-semibold">{stats.approved}</span> / 25 filled
              {' '}({25 - stats.approved} remaining)
            </span>
            <div className="w-48 bg-[#0A0F1A] rounded-full h-2">
              <div
                className="bg-gradient-to-r from-[#00BFFF] to-[#007BFF] h-2 rounded-full transition-all"
                style={{ width: `${Math.min((stats.approved / 25) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#1A1F2E] border border-[#2A3F5F] rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setFilter('all')} className={getFilterButtonClass('all')}>
              All ({stats.total})
            </button>
            <button onClick={() => setFilter('pending')} className={getFilterButtonClass('pending')}>
              Pending ({stats.pending})
            </button>
            <button onClick={() => setFilter('approved')} className={getFilterButtonClass('approved')}>
              Approved ({stats.approved})
            </button>
            <button onClick={() => setFilter('rejected')} className={getFilterButtonClass('rejected')}>
              Rejected ({stats.rejected})
            </button>
            <button onClick={() => setFilter('waitlisted')} className={getFilterButtonClass('waitlisted')}>
              Waitlisted ({stats.waitlisted})
            </button>
            <button
              onClick={fetchApplications}
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

        {/* Applications List */}
        <div className="bg-[#1A1F2E] border border-[#2A3F5F] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#00BFFF]"></div>
              <p className="mt-4">Loading applications...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p>No applications found{filter !== 'all' ? ` with status: ${filter}` : ''}</p>
            </div>
          ) : (
            <div>
              <table className="w-full">
                <thead className="bg-[#0A0F1A] border-b border-[#2A3F5F]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Applicant</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company Size</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3F5F]">
                  {filteredApplications.map((app) => (
                    <>
                      <tr key={app.id} className="hover:bg-[#0A0F1A]/50 transition-colors">
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                            className="text-left group"
                          >
                            <div className="text-sm font-medium text-white group-hover:text-[#00BFFF] transition-colors">{app.full_name}</div>
                            <div className="text-xs text-gray-400">{app.email}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {expandedId === app.id ? 'Click to collapse' : 'Click to expand details'}
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">{app.role_title}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">{app.company_size}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">{new Date(app.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(app.status)}`}>
                            {app.status}
                          </span>
                          {app.reviewed_at && (
                            <div className="text-xs text-gray-500 mt-1">Reviewed {new Date(app.reviewed_at).toLocaleDateString()}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {app.status === 'pending' && (
                              <>
                                <button onClick={() => handleAction(app.id, 'approve')} disabled={actionLoading === app.id} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                  {actionLoading === app.id ? '...' : 'Approve'}
                                </button>
                                <button onClick={() => handleAction(app.id, 'reject')} disabled={actionLoading === app.id} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                  {actionLoading === app.id ? '...' : 'Reject'}
                                </button>
                                <button onClick={() => handleAction(app.id, 'waitlist')} disabled={actionLoading === app.id} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                  {actionLoading === app.id ? '...' : 'Waitlist'}
                                </button>
                              </>
                            )}
                            {app.status === 'waitlisted' && (
                              <>
                                <button onClick={() => handleAction(app.id, 'approve')} disabled={actionLoading === app.id} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                  {actionLoading === app.id ? '...' : 'Approve'}
                                </button>
                                <button onClick={() => handleAction(app.id, 'reject')} disabled={actionLoading === app.id} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                  {actionLoading === app.id ? '...' : 'Reject'}
                                </button>
                              </>
                            )}
                            {app.status === 'approved' && (
                              <button
                                onClick={() => handleRevoke(app.id)}
                                disabled={actionLoading === app.id}
                                className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {actionLoading === app.id ? '...' : 'Revoke'}
                              </button>
                            )}
                            {app.status === 'rejected' && <span className="text-red-400 text-xs font-medium">Rejected</span>}
                          </div>
                        </td>
                      </tr>
                      {expandedId === app.id && (
                        <tr key={`detail-${app.id}`}>
                          <td colSpan={6} className="bg-[#0A0F1A]/50 px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tools & Systems Used</h4>
                                <p className="text-sm text-gray-300 whitespace-pre-wrap">{app.tools_systems_used}</p>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Biggest Challenge</h4>
                                <p className="text-sm text-gray-300 whitespace-pre-wrap">{app.biggest_challenge}</p>
                              </div>
                              <div className="md:col-span-2">
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Why They Want to Beta Test</h4>
                                <p className="text-sm text-gray-300 whitespace-pre-wrap">{app.why_beta_test}</p>
                              </div>
                              {app.review_notes && (
                                <div className="md:col-span-2">
                                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Review Notes</h4>
                                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{app.review_notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
