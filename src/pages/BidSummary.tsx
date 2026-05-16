import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { TaskOrder, SowItem, SowQuote, Subcontractor } from '../lib/types'
import {
  ArrowLeft, BarChart3, AlertTriangle,
  TrendingUp, Clock
} from 'lucide-react'

interface SowBidData {
  sow: SowItem
  quotes: (SowQuote & { subcontractor_name: string })[]
  subCount: number
  respondedCount: number
  lowestQuote: number | null
  highestQuote: number | null
  avgQuote: number | null
  recommendedSub: string | null
  recommendedAmount: number | null
}

export default function BidSummary() {
  const { id: taskOrderId } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [bidData, setBidData] = useState<SowBidData[]>([])
  const [loading, setLoading] = useState(true)
  const [, setSubMap] = useState<Map<string, Subcontractor>>(new Map())

  useEffect(() => {
    if (taskOrderId) fetchData()
  }, [taskOrderId])

  async function fetchData() {
    const [toRes, sowRes, subsRes] = await Promise.all([
      supabase.from('task_orders').select('*').eq('id', taskOrderId).single(),
      supabase.from('sow_items').select('*').eq('task_order_id', taskOrderId).order('service_category'),
      supabase.from('subcontractors').select('*'),
    ])

    setTaskOrder(toRes.data)
    const sMap = new Map<string, Subcontractor>()
    for (const s of (subsRes.data || [])) sMap.set(s.id, s)
    setSubMap(sMap)

    const data: SowBidData[] = []
    for (const sow of (sowRes.data || [])) {
      const { data: sowSubs } = await supabase
        .from('sow_subcontractors')
        .select('*')
        .eq('sow_item_id', sow.id)

      const responded = (sowSubs || []).filter(ss => ['quote_submitted', 'awarded'].includes(ss.outreach_status))

      const { data: quotes } = await supabase
        .from('sow_quotes')
        .select('*')
        .eq('sow_item_id', sow.id)
        .order('total_amount')

      const enrichedQuotes = (quotes || []).map(q => ({
        ...q,
        subcontractor_name: sMap.get(q.subcontractor_id)?.company_name || 'Unknown',
      }))

      const amounts = enrichedQuotes.filter(q => q.total_amount != null).map(q => q.total_amount as number)
      const lowest = amounts.length > 0 ? Math.min(...amounts) : null
      const highest = amounts.length > 0 ? Math.max(...amounts) : null
      const avg = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : null

      // Recommend: lowest quote that is accepted or received (not rejected)
      const eligible = enrichedQuotes.filter(q => q.total_amount != null && q.status !== 'rejected' && q.status !== 'expired')
      const best = eligible.length > 0 ? eligible.reduce((a, b) => ((a.total_amount || Infinity) < (b.total_amount || Infinity) ? a : b)) : null

      data.push({
        sow,
        quotes: enrichedQuotes,
        subCount: (sowSubs || []).length,
        respondedCount: responded.length,
        lowestQuote: lowest,
        highestQuote: highest,
        avgQuote: avg,
        recommendedSub: best ? best.subcontractor_name : null,
        recommendedAmount: best ? best.total_amount : null,
      })
    }

    setBidData(data)
    setLoading(false)
  }

  const fmt = (n: number | null) => n != null ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'
  const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`

  const totalSows = bidData.length
  const sowsWithQuotes = bidData.filter(d => d.quotes.length > 0).length
  const totalQuotes = bidData.reduce((acc, d) => acc + d.quotes.length, 0)
  const totalLow = bidData.reduce((acc, d) => acc + (d.lowestQuote || 0), 0)
  const totalHigh = bidData.reduce((acc, d) => acc + (d.highestQuote || 0), 0)
  const totalRecommended = bidData.reduce((acc, d) => acc + (d.recommendedAmount || 0), 0)
  const coveragePercent = totalSows > 0 ? Math.round((sowsWithQuotes / totalSows) * 100) : 0

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>
  if (!taskOrder) return <div className="text-center py-12 text-red-500">Task order not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to={`/task-orders/${taskOrderId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft size={14} /> Back to {taskOrder.title}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={24} className="text-emerald-600" />
          Bid Summary Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">Aggregated pricing view across all SOWs for {taskOrder.title}</p>
      </div>

      {/* Key Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
          <div className="text-3xl font-bold text-blue-800">{coveragePercent}%</div>
          <div className="text-sm text-blue-600 mt-1">Quote Coverage</div>
          <div className="text-xs text-blue-400">{sowsWithQuotes} of {totalSows} SOWs</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
          <div className="text-3xl font-bold text-green-800">{totalQuotes}</div>
          <div className="text-sm text-green-600 mt-1">Total Quotes</div>
          <div className="text-xs text-green-400">Across all SOWs</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
          <div className="text-3xl font-bold text-emerald-800">{totalLow > 0 ? fmtK(totalLow) : '—'}</div>
          <div className="text-sm text-emerald-600 mt-1">Low Estimate Total</div>
          <div className="text-xs text-emerald-400">Sum of lowest per SOW</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200">
          <div className="text-3xl font-bold text-amber-800">{totalHigh > 0 ? fmtK(totalHigh) : '—'}</div>
          <div className="text-sm text-amber-600 mt-1">High Estimate Total</div>
          <div className="text-xs text-amber-400">Sum of highest per SOW</div>
        </div>
      </div>

      {/* Recommended total */}
      {totalRecommended > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium opacity-80">Recommended Bid Total (Subcontractor Cost)</div>
              <div className="text-4xl font-bold mt-1">{fmt(totalRecommended)}</div>
              <div className="text-sm opacity-80 mt-1">Based on lowest eligible quote per SOW</div>
            </div>
            <TrendingUp size={48} className="opacity-30" />
          </div>
        </div>
      )}

      {/* SOW-by-SOW Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">SOW-by-SOW Breakdown</h2>
          <Link to={`/task-orders/${taskOrderId}/sow-tracker`} className="text-sm text-blue-600 hover:underline">
            Open Full Tracker →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">SOW / Service</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Subs</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Quotes</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Low</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">High</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Avg</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Recommended</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bidData.map(d => {
                const qc = d.quotes.length
                const coverageColor = qc >= 3 ? 'bg-green-500' : qc >= 1 ? 'bg-amber-500' : 'bg-red-400'
                return (
                  <tr key={d.sow.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${coverageColor}`} />
                        <span className="font-medium text-gray-900">{d.sow.sow_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        d.sow.status === 'awarded' ? 'bg-green-100 text-green-700' :
                        d.sow.status === 'quotes_received' || d.sow.status === 'evaluating' ? 'bg-amber-100 text-amber-700' :
                        d.sow.status === 'rfqs_sent' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {d.sow.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{d.subCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${qc >= 3 ? 'text-green-600' : qc >= 1 ? 'text-amber-600' : 'text-red-500'}`}>{qc}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(d.lowestQuote)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt(d.highestQuote)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(d.avgQuote)}</td>
                    <td className="px-4 py-3">
                      {d.recommendedSub ? (
                        <div>
                          <span className="text-sm font-medium text-gray-900">{d.recommendedSub}</span>
                          <span className="text-xs text-green-600 ml-2">{fmt(d.recommendedAmount)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No quotes</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {bidData.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-900">TOTAL</td>
                  <td />
                  <td className="px-4 py-3 text-center text-gray-700">{new Set(bidData.flatMap(d => d.quotes.map(q => q.subcontractor_id))).size}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{totalQuotes}</td>
                  <td className="px-4 py-3 text-right text-green-700">{totalLow > 0 ? fmt(totalLow) : '—'}</td>
                  <td className="px-4 py-3 text-right text-red-600">{totalHigh > 0 ? fmt(totalHigh) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">—</td>
                  <td className="px-4 py-3 text-green-700">{totalRecommended > 0 ? fmt(totalRecommended) : '—'}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Quote Comparison per SOW */}
      {bidData.filter(d => d.quotes.length > 0).map(d => (
        <div key={d.sow.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">{d.sow.sow_name} — Quote Comparison</h3>
            <p className="text-xs text-gray-500">{d.quotes.length} quote{d.quotes.length !== 1 ? 's' : ''} received</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-600">Subcontractor</th>
                  <th className="text-right px-4 py-2 text-gray-600">Total</th>
                  <th className="text-right px-4 py-2 text-gray-600">Monthly</th>
                  <th className="text-right px-4 py-2 text-gray-600">Labor</th>
                  <th className="text-right px-4 py-2 text-gray-600">Materials</th>
                  <th className="text-right px-4 py-2 text-gray-600">OH %</th>
                  <th className="text-center px-4 py-2 text-gray-600">Status</th>
                  <th className="text-left px-4 py-2 text-gray-600">Exclusions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.quotes.map((q, qi) => (
                  <tr key={q.id} className={`${qi === 0 && q.status !== 'rejected' ? 'bg-green-50' : ''} hover:bg-gray-50`}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-gray-900">{q.subcontractor_name}</span>
                      {qi === 0 && q.status !== 'rejected' && (
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Lowest</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">{fmt(q.total_amount)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmt(q.monthly_amount)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmt(q.labor_cost)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmt(q.materials_cost)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{q.overhead_markup ? `${q.overhead_markup}%` : '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        q.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        q.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        q.status === 'under_review' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{q.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-red-600 max-w-[200px] truncate">
                      {q.scope_exclusions || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Gaps & Warnings */}
      {bidData.some(d => d.quotes.length === 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
            <AlertTriangle size={18} /> SOWs Without Quotes
          </h3>
          <div className="space-y-2">
            {bidData.filter(d => d.quotes.length === 0).map(d => (
              <div key={d.sow.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-100">
                <div>
                  <span className="font-medium text-gray-900">{d.sow.sow_name}</span>
                  <span className="text-xs text-gray-500 ml-2">{d.subCount} sub{d.subCount !== 1 ? 's' : ''} assigned</span>
                </div>
                <Link
                  to={`/task-orders/${taskOrderId}/sow-tracker`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Manage →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single-quote warnings */}
      {bidData.some(d => d.quotes.length === 1) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-3">
            <Clock size={18} /> SOWs with Only 1 Quote (Consider Getting More)
          </h3>
          <div className="space-y-2">
            {bidData.filter(d => d.quotes.length === 1).map(d => (
              <div key={d.sow.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                <div>
                  <span className="font-medium text-gray-900">{d.sow.sow_name}</span>
                  <span className="text-xs text-gray-500 ml-2">Quote: {fmt(d.lowestQuote)} from {d.quotes[0]?.subcontractor_name}</span>
                </div>
                <Link
                  to={`/task-orders/${taskOrderId}/sow-tracker`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Add More Subs →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
