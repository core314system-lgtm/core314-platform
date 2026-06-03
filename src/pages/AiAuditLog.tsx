import { useEffect, useState } from 'react'
import { Brain, Clock, Zap, AlertTriangle, ChevronLeft, ChevronRight, Download, Filter } from 'lucide-react'
import { fetchAiAuditLog, fetchAiStats, type AiAuditEntry } from '../lib/aiAuditLog'

const REQUEST_TYPE_LABELS: Record<string, string> = {
  document_analysis: 'Document Analysis',
  compliance_matrix: 'Compliance Matrix',
  rfq_packages: 'RFQ Packages',
  clarification_questions: 'Clarification Questions',
  pricing_risks: 'Pricing Risks',
  executive_summary: 'Executive Summary',
  project_comparison: 'Project Comparison',
  global_chat: 'Global Chat',
  project_chat: 'Project Chat',
  bid_decision: 'Bid Decision',
}

const REQUEST_TYPE_COLORS: Record<string, string> = {
  document_analysis: 'bg-blue-100 text-blue-700',
  compliance_matrix: 'bg-purple-100 text-purple-700',
  rfq_packages: 'bg-green-100 text-green-700',
  clarification_questions: 'bg-amber-100 text-amber-700',
  pricing_risks: 'bg-red-100 text-red-700',
  executive_summary: 'bg-indigo-100 text-indigo-700',
  project_comparison: 'bg-cyan-100 text-cyan-700',
  global_chat: 'bg-gray-100 text-gray-700',
  project_chat: 'bg-teal-100 text-teal-700',
  bid_decision: 'bg-orange-100 text-orange-700',
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export default function AiAuditLog() {
  const [entries, setEntries] = useState<AiAuditEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [stats, setStats] = useState<{
    totalCalls: number; totalTokens: number; avgLatency: number; errorRate: number
    byRequestType: Record<string, { count: number; tokens: number }>
    recentTrend: { date: string; calls: number; tokens: number }[]
  } | null>(null)

  const PAGE_SIZE = 25

  useEffect(() => {
    loadData()
  }, [page, filterType])

  async function loadData() {
    setLoading(true)
    try {
      const [logResult, statsResult] = await Promise.all([
        fetchAiAuditLog({ page, pageSize: PAGE_SIZE, requestType: filterType }),
        page === 1 ? fetchAiStats() : Promise.resolve(null),
      ])
      setEntries(logResult.data)
      setTotalCount(logResult.count)
      if (statsResult) setStats(statsResult)
    } catch (err) {
      console.error('Failed to load AI audit log:', err)
    } finally {
      setLoading(false)
    }
  }

  function exportCsv() {
    const headers = ['Timestamp', 'Request Type', 'Model', 'Prompt Tokens', 'Completion Tokens', 'Total Tokens', 'Latency (ms)', 'Status', 'Project', 'Documents', 'Error']
    const rows = entries.map(e => [
      e.created_at || '',
      e.request_type,
      e.model,
      e.prompt_tokens,
      e.completion_tokens,
      e.total_tokens,
      e.latency_ms,
      e.status,
      e.task_order_title || '',
      e.document_context || '',
      e.error_message || '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Activity Log</h1>
        <p className="text-sm text-gray-500 mt-1">Complete audit trail of all AI operations</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Brain size={14} /> Total AI Calls
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalCalls.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Zap size={14} /> Total Tokens
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatTokens(stats.totalTokens)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Clock size={14} /> Avg Latency
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatMs(stats.avgLatency)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <AlertTriangle size={14} /> Error Rate
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.errorRate}%</div>
          </div>
        </div>
      )}

      {/* Usage by Type */}
      {stats && Object.keys(stats.byRequestType).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Usage by AI Operation</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(stats.byRequestType)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([type, data]) => (
                <div key={type} className="bg-gray-50 rounded-lg p-3">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-1 ${REQUEST_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'}`}>
                    {REQUEST_TYPE_LABELS[type] || type}
                  </div>
                  <div className="text-lg font-bold text-gray-900">{data.count}</div>
                  <div className="text-xs text-gray-500">{formatTokens(data.tokens)} tokens</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter + Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
          >
            <option value="all">All Types</option>
            {Object.entries(REQUEST_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">{totalCount} entries</span>
        </div>
        <button
          onClick={exportCsv}
          disabled={entries.length === 0}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">Loading audit log...</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Brain size={32} className="mb-2" />
            <p className="text-sm">No AI activity recorded yet</p>
            <p className="text-xs mt-1">AI calls will appear here as users interact with the platform</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Operation</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tokens</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Latency</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, i) => (
                  <tr key={entry.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_TYPE_COLORS[entry.request_type] || 'bg-gray-100 text-gray-700'}`}>
                        {REQUEST_TYPE_LABELS[entry.request_type] || entry.request_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-[200px] truncate">
                      {entry.task_order_title || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-right font-mono">
                      {formatTokens(entry.total_tokens)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-right font-mono">
                      {formatMs(entry.latency_ms)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.status === 'success' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-green-50 text-green-700">OK</span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-red-50 text-red-700" title={entry.error_message || ''}>
                          Error
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {entry.model}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 disabled:opacity-50"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 disabled:opacity-50"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Compliance Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <h3 className="font-semibold mb-1">AI Compliance — Activity Monitoring</h3>
        <p>This audit log records every AI interaction including prompts, models used, token consumption, and response metadata. All data is stored in Supabase with row-level security and encrypted at rest. No AI outputs are used for autonomous decision-making — all AI features are advisory with human review required.</p>
      </div>
    </div>
  )
}
