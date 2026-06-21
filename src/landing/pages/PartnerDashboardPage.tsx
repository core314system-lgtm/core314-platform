import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  DollarSign, Users, TrendingUp, Copy, Check,
  BarChart3, Clock, AlertCircle, Loader2,
  ArrowRight,
} from 'lucide-react'

interface PartnerInfo {
  name: string
  email: string
  referral_code: string
  referral_link: string
  commission_rate: number
  commission_months: number
  created_at: string
}

interface Signup {
  id: string
  company_name: string
  plan_name: string
  status: string
  created_at: string
  subscription_started_at: string | null
  subscription_cancelled_at: string | null
  monthly_amount: number
}

interface MonthlyHistory {
  month: string
  subscribers: number
  revenue: number
  commission: number
  status: string
  paid_at: string | null
}

interface Subscriber {
  company: string
  plan: string
  monthly_amount: number
  commission: number
  started: string
  months_active: number
  months_remaining: number
}

interface CommissionData {
  total_signups: number
  trial_signups: number
  active_subscribers: number
  cancelled: number
  current_monthly_commission: number
  total_paid: number
  projected_total: number
  subscribers: Subscriber[]
  monthly_history: MonthlyHistory[]
}

interface DashboardData {
  partner: PartnerInfo
  signups: Signup[]
  commissions: CommissionData
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function formatMonth(month: string): string {
  const [year, mo] = month.split('-')
  const date = new Date(parseInt(year), parseInt(mo) - 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function PartnerDashboardPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('no_token')
      setLoading(false)
      return
    }

    fetch(`/.netlify/functions/partner-program?action=dashboard&token=${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Unauthorized')
        return r.json()
      })
      .then(setData)
      .catch(() => setError('Failed to load dashboard. Your session may have expired.'))
      .finally(() => setLoading(false))
  }, [token])

  function copyLink() {
    if (!data) return
    navigator.clipboard.writeText(data.partner.referral_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (error === 'no_token') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Login Required</h1>
          <p className="text-slate-400 mb-6">Please log in to access your partner dashboard.</p>
          <Link
            to="/partners/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
          >
            Go to Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Session Expired</h1>
          <p className="text-slate-400 mb-6">{error || 'Please log in again to access your dashboard.'}</p>
          <Link
            to="/partners/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
          >
            Log In Again <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  const { partner, commissions } = data

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Procu<span className="text-purple-400">vex</span>
            </span>
            <span className="text-xs text-slate-500 ml-2 border-l border-slate-700 pl-2">Partner Dashboard</span>
          </Link>
          <div className="text-sm text-slate-400">
            {partner.name}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Referral Link */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6 mb-8">
          <p className="text-sm text-purple-400 font-semibold mb-2">Your Referral Link</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-slate-900 text-purple-300 px-4 py-3 rounded-lg text-sm font-mono border border-slate-700 overflow-hidden text-ellipsis">
              {partner.referral_link}
            </code>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-semibold transition-colors flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Users className="w-4 h-4" /> Total Sign-ups
            </div>
            <p className="text-3xl font-bold text-white">{commissions.total_signups}</p>
            {commissions.trial_signups > 0 && (
              <p className="text-xs text-slate-500 mt-1">{commissions.trial_signups} in trial</p>
            )}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <BarChart3 className="w-4 h-4" /> Active Subscribers
            </div>
            <p className="text-3xl font-bold text-green-400">{commissions.active_subscribers}</p>
            {commissions.cancelled > 0 && (
              <p className="text-xs text-slate-500 mt-1">{commissions.cancelled} cancelled</p>
            )}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <DollarSign className="w-4 h-4" /> Monthly Commission
            </div>
            <p className="text-3xl font-bold text-purple-400">{formatCurrency(commissions.current_monthly_commission)}</p>
            <p className="text-xs text-slate-500 mt-1">20% recurring</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Projected Total
            </div>
            <p className="text-3xl font-bold text-white">{formatCurrency(commissions.projected_total)}</p>
            <p className="text-xs text-slate-500 mt-1">if all subs stay active</p>
          </div>
        </div>

        {/* Active Subscribers Table */}
        {commissions.subscribers.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl mb-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">Active Subscribers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Company</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3">Monthly</th>
                    <th className="px-6 py-3">Your 20%</th>
                    <th className="px-6 py-3">Started</th>
                    <th className="px-6 py-3">Months Left</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.subscribers.map((sub, i) => (
                    <tr key={i} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-6 py-4 text-white font-medium">{sub.company || 'Unknown'}</td>
                      <td className="px-6 py-4 text-slate-300">{sub.plan}</td>
                      <td className="px-6 py-4 text-slate-300">{formatCurrency(sub.monthly_amount)}</td>
                      <td className="px-6 py-4 text-purple-400 font-semibold">{formatCurrency(sub.commission)}</td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {sub.started ? new Date(sub.started).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{sub.months_remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Commission History */}
        {commissions.monthly_history.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl mb-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Commission History</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Paid
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" /> Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" /> Projected
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Month</th>
                    <th className="px-6 py-3">Subscribers</th>
                    <th className="px-6 py-3">Revenue Generated</th>
                    <th className="px-6 py-3">Your Commission</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.monthly_history.map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-6 py-4 text-white font-medium">{formatMonth(row.month)}</td>
                      <td className="px-6 py-4 text-slate-300">{row.subscribers}</td>
                      <td className="px-6 py-4 text-slate-300">{formatCurrency(row.revenue)}</td>
                      <td className="px-6 py-4 text-purple-400 font-semibold">{formatCurrency(row.commission)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          row.status === 'paid'
                            ? 'bg-green-500/10 text-green-400'
                            : row.status === 'pending'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {row.status === 'paid' && <Check className="w-3 h-3" />}
                          {row.status === 'pending' && <Clock className="w-3 h-3" />}
                          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.08]">
                    <td className="px-6 py-4 text-white font-bold" colSpan={2}>
                      Total Earned
                    </td>
                    <td className="px-6 py-4 text-slate-300" />
                    <td className="px-6 py-4 text-green-400 font-bold text-lg">
                      {formatCurrency(commissions.total_paid)}
                    </td>
                    <td className="px-6 py-4" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* All Referrals */}
        {data.signups.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl mb-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">All Referrals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Company</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {data.signups.map((signup) => (
                    <tr key={signup.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-6 py-4 text-white font-medium">{signup.company_name}</td>
                      <td className="px-6 py-4 text-slate-300">{signup.plan_name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                          signup.status === 'active'
                            ? 'bg-green-500/10 text-green-400'
                            : signup.status === 'trial'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {signup.status.charAt(0).toUpperCase() + signup.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {new Date(signup.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {data.signups.length === 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 text-center mb-8">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Referrals Yet</h3>
            <p className="text-slate-400 text-sm mb-6">
              Share your referral link to start earning commissions.
            </p>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-semibold transition-colors"
            >
              <Copy className="w-4 h-4" /> Copy Referral Link
            </button>
          </div>
        )}

        {/* Program Info */}
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Commission Terms</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Rate</p>
              <p className="text-white font-medium">{(partner.commission_rate * 100).toFixed(0)}% recurring</p>
            </div>
            <div>
              <p className="text-slate-500">Duration</p>
              <p className="text-white font-medium">{partner.commission_months} months / subscriber</p>
            </div>
            <div>
              <p className="text-slate-500">Payout</p>
              <p className="text-white font-medium">Monthly, net 30</p>
            </div>
            <div>
              <p className="text-slate-500">Minimum</p>
              <p className="text-white font-medium">$100</p>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-600 pb-8">
          <Link to="/partners/terms" className="hover:text-slate-400 transition-colors">
            Partner Program Terms & Conditions
          </Link>
          <span className="mx-2">&middot;</span>
          <a href="mailto:team@procuvex.com" className="hover:text-slate-400 transition-colors">
            Support: team@procuvex.com
          </a>
        </div>
      </div>
    </div>
  )
}
