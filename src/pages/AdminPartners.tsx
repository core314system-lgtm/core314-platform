import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Check, X, DollarSign,
  RefreshCw, Copy, Search,
} from 'lucide-react'

interface Partner {
  id: string
  name: string
  email: string
  company: string | null
  audience_size: string | null
  promotion_method: string | null
  referral_code: string
  commission_rate: number
  commission_months: number
  status: 'pending' | 'active' | 'rejected' | 'suspended'
  created_at: string
  approved_at: string | null
  signup_count: number
  active_subscriber_count: number
}

export default function AdminPartners() {
  const { user } = useAuth()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [payoutModal, setPayoutModal] = useState<{ partnerId: string; partnerName: string } | null>(null)
  const [payoutMonth, setPayoutMonth] = useState('')
  const [payoutAmount, setPayoutAmount] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  async function loadPartners() {
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/partner-program?action=list', {
        headers: { 'x-user-id': user?.id || '' },
      })
      const data = await res.json()
      if (data.partners) setPartners(data.partners)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadPartners() }, [])

  async function handleAction(partnerId: string, action: 'approve' | 'reject') {
    setProcessing(partnerId)
    try {
      await fetch('/.netlify/functions/partner-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ action, partner_id: partnerId }),
      })
      await loadPartners()
    } catch { /* ignore */ }
    setProcessing(null)
  }

  async function handleMarkPaid() {
    if (!payoutModal || !payoutMonth || !payoutAmount) return
    setProcessing(payoutModal.partnerId)
    try {
      await fetch('/.netlify/functions/partner-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          action: 'mark_paid',
          partner_id: payoutModal.partnerId,
          month: payoutMonth,
          amount: parseFloat(payoutAmount),
        }),
      })
      setPayoutModal(null)
      setPayoutMonth('')
      setPayoutAmount('')
    } catch { /* ignore */ }
    setProcessing(null)
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/r/${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const filtered = partners.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q)
    }
    return true
  })

  const pendingCount = partners.filter(p => p.status === 'pending').length
  const activeCount = partners.filter(p => p.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Partner Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {activeCount} active partner{activeCount !== 1 ? 's' : ''} &middot; {pendingCount} pending application{pendingCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={loadPartners}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
          {(['all', 'pending', 'active', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search partners..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No partners found</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Partner</th>
                  <th className="px-5 py-3">Referral Code</th>
                  <th className="px-5 py-3">Sign-ups</th>
                  <th className="px-5 py-3">Active Subs</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Applied</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{p.email}</p>
                        {p.company && <p className="text-gray-400 dark:text-gray-500 text-xs">{p.company}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => copyCode(p.referral_code)}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        {copiedCode === p.referral_code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {p.referral_code}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 font-medium">{p.signup_count}</td>
                    <td className="px-5 py-4 text-green-600 dark:text-green-400 font-medium">{p.active_subscriber_count}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                        p.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : p.status === 'pending'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {p.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAction(p.id, 'approve')}
                              disabled={processing === p.id}
                              className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAction(p.id, 'reject')}
                              disabled={processing === p.id}
                              className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {p.status === 'active' && (
                          <button
                            onClick={() => setPayoutModal({ partnerId: p.id, partnerName: p.name })}
                            className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                            title="Record Payout"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {payoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Record Payout — {payoutModal.partnerName}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Month (YYYY-MM)</label>
                <input
                  type="month"
                  value={payoutMonth}
                  onChange={e => setPayoutMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setPayoutModal(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={!payoutMonth || !payoutAmount || processing === payoutModal.partnerId}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition-colors disabled:opacity-50"
              >
                {processing === payoutModal.partnerId ? 'Saving...' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
