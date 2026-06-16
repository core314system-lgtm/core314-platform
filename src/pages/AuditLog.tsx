import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ClipboardList, Search, Download, Filter } from 'lucide-react'

interface AuditEvent {
  id: string
  user_id: string
  org_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
  user_email?: string
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: 'Login', color: 'bg-blue-100 text-blue-700' },
  logout: { label: 'Logout', color: 'bg-gray-100 text-gray-700' },
  mfa_enrolled: { label: 'MFA Enabled', color: 'bg-green-100 text-green-700' },
  mfa_removed: { label: 'MFA Disabled', color: 'bg-amber-100 text-amber-700' },
  password_changed: { label: 'Password Changed', color: 'bg-purple-100 text-purple-700' },
  data_export: { label: 'Data Export', color: 'bg-orange-100 text-orange-700' },
  sub_connection_created: { label: 'Sub Connected', color: 'bg-green-100 text-green-700' },
  sub_connection_removed: { label: 'Sub Disconnected', color: 'bg-red-100 text-red-700' },
  profile_viewed: { label: 'Profile Viewed', color: 'bg-slate-100 text-slate-700' },
  settings_changed: { label: 'Settings Changed', color: 'bg-indigo-100 text-indigo-700' },
  permission_changed: { label: 'Permission Changed', color: 'bg-yellow-100 text-yellow-700' },
  member_invited: { label: 'Member Invited', color: 'bg-teal-100 text-teal-700' },
  member_removed: { label: 'Member Removed', color: 'bg-red-100 text-red-700' },
  project_created: { label: 'Project Created', color: 'bg-emerald-100 text-emerald-700' },
  project_deleted: { label: 'Project Deleted', color: 'bg-red-100 text-red-700' },
  document_uploaded: { label: 'Document Uploaded', color: 'bg-blue-100 text-blue-700' },
  rfq_sent: { label: 'RFQ Sent', color: 'bg-violet-100 text-violet-700' },
  account_deleted: { label: 'Account Deleted', color: 'bg-red-100 text-red-700' },
}

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 50

  useEffect(() => {
    loadEvents()
  }, [page, filterAction])

  async function loadEvents() {
    setLoading(true)
    let query = supabase
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (filterAction) {
      query = query.eq('action', filterAction)
    }

    const { data } = await query
    setEvents(data || [])
    setLoading(false)
  }

  async function handleExport() {
    const { data } = await supabase
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000)

    if (!data) return

    const csv = [
      'Timestamp,Action,User ID,Resource Type,Resource ID,Metadata',
      ...data.map(e =>
        `${e.created_at},${e.action},${e.user_id},${e.resource_type || ''},${e.resource_id || ''},"${JSON.stringify(e.metadata || {}).replace(/"/g, '""')}"`
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredEvents = searchTerm
    ? events.filter(e =>
        e.action.includes(searchTerm.toLowerCase()) ||
        e.resource_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.user_id.includes(searchTerm)
      )
    : events

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            Audit Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track all user actions and security events</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-200"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by action, resource, or user..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(0) }}
            className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Resource</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : filteredEvents.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No audit events found</td></tr>
              ) : (
                filteredEvents.map(event => {
                  const actionInfo = ACTION_LABELS[event.action] || { label: event.action, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(event.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {event.user_id?.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {event.resource_type && (
                          <span className="text-xs">
                            {event.resource_type}
                            {event.resource_id && <span className="text-gray-400 ml-1">#{event.resource_id.slice(0, 8)}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                        {event.metadata && Object.keys(event.metadata).length > 0
                          ? JSON.stringify(event.metadata).slice(0, 100)
                          : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={filteredEvents.length < pageSize}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
