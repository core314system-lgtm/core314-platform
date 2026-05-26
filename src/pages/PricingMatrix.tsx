import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { TaskOrder, SowItem, SowQuote, Subcontractor } from '../lib/types'
import { ArrowLeft, DollarSign, Percent, TrendingUp, CheckCircle2, AlertTriangle, Calculator, Save, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

// ========== Types ==========
interface MarkupProfile {
  name: string
  type: 'percentage' | 'dollar' | 'none'
  value: number
  description: string
}

interface SowPricingRow {
  sow: SowItem
  quotes: (SowQuote & { subcontractor_name: string })[]
  selectedSubId: string | null
  selectedQuoteId: string | null
  subCost: number
  markupType: 'percentage' | 'dollar' | 'manual'
  markupValue: number
  supplierTotal: number
  baseAnnual: number
  escalationRate: number
  additionalCosts: number
  additionalCostsNote: string
}

const DEFAULT_PROFILES: MarkupProfile[] = [
  { name: 'Pass-Through (0%)', type: 'none', value: 0, description: 'No markup — sub cost = supplier cost' },
  { name: 'Competitive (5%)', type: 'percentage', value: 5, description: 'Minimal margin for competitive bids' },
  { name: 'Standard (10%)', type: 'percentage', value: 10, description: 'Standard industry markup' },
  { name: 'High-Risk (15%)', type: 'percentage', value: 15, description: 'Higher margin for risky or complex work' },
  { name: 'Premium (20%)', type: 'percentage', value: 20, description: 'Premium services or sole-source situations' },
  { name: 'Custom', type: 'percentage', value: -1, description: 'Enter your own markup percentage' },
]

const ESCALATION_RATES = [
  { label: 'None (0%)', value: 0 },
  { label: '2% Annual', value: 2 },
  { label: '3% Annual', value: 3 },
  { label: '4% Annual', value: 4 },
  { label: '5% Annual', value: 5 },
  { label: 'Custom', value: -1 },
]

function formatCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export default function PricingMatrix() {
  const { id: taskOrderId } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SowPricingRow[]>([])
  const [globalProfile, setGlobalProfile] = useState<string>('Standard (10%)')
  const [customMarkup, setCustomMarkup] = useState(12)
  const [globalEscalation, setGlobalEscalation] = useState(3)
  const [customEscalation, setCustomEscalation] = useState(3)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [popYears, setPopYears] = useState({ base: 2, options: [2, 2] })

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

    const newRows: SowPricingRow[] = []
    for (const sow of (sowRes.data || [])) {
      const { data: quotes } = await supabase
        .from('sow_quotes')
        .select('*')
        .eq('sow_item_id', sow.id)

      const enriched = (quotes || []).map(q => ({
        ...q,
        subcontractor_name: sMap.get(q.subcontractor_id)?.company_name || 'Unknown',
      }))

      // Find lowest quote as default selection
      const sortedByPrice = enriched.filter(q => q.total_amount).sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0))
      const bestQuote = sortedByPrice[0] || null

      newRows.push({
        sow,
        quotes: enriched,
        selectedSubId: bestQuote?.subcontractor_id || null,
        selectedQuoteId: bestQuote?.id || null,
        subCost: bestQuote?.total_amount || 0,
        markupType: 'percentage',
        markupValue: 10,
        supplierTotal: bestQuote ? Math.round((bestQuote.total_amount || 0) * 1.10) : 0,
        baseAnnual: bestQuote?.annual_amount || bestQuote?.total_amount || 0,
        escalationRate: 3,
        additionalCosts: 0,
        additionalCostsNote: '',
      })
    }

    setRows(newRows)
    setLoading(false)
  }

  function selectQuote(sowId: string, quoteId: string, subId: string, amount: number, annualAmount: number | null) {
    setRows(prev => prev.map(r => {
      if (r.sow.id !== sowId) return r
      const subCost = amount
      const supplierTotal = calculateSupplierTotal(subCost, r.markupType, r.markupValue, r.additionalCosts)
      return { ...r, selectedSubId: subId, selectedQuoteId: quoteId, subCost, baseAnnual: annualAmount || amount, supplierTotal }
    }))
  }

  function calculateSupplierTotal(subCost: number, markupType: string, markupValue: number, additionalCosts: number): number {
    let total = subCost
    if (markupType === 'percentage') {
      total = subCost * (1 + markupValue / 100)
    } else if (markupType === 'dollar') {
      total = subCost + markupValue
    } else if (markupType === 'manual') {
      total = markupValue
    }
    return Math.round(total + additionalCosts)
  }

  function updateMarkup(sowId: string, type: 'percentage' | 'dollar' | 'manual', value: number) {
    setRows(prev => prev.map(r => {
      if (r.sow.id !== sowId) return r
      const supplierTotal = calculateSupplierTotal(r.subCost, type, value, r.additionalCosts)
      return { ...r, markupType: type, markupValue: value, supplierTotal }
    }))
  }

  function updateAdditionalCosts(sowId: string, costs: number, note: string) {
    setRows(prev => prev.map(r => {
      if (r.sow.id !== sowId) return r
      const supplierTotal = calculateSupplierTotal(r.subCost, r.markupType, r.markupValue, costs)
      return { ...r, additionalCosts: costs, additionalCostsNote: note, supplierTotal }
    }))
  }

  function updateEscalation(sowId: string, rate: number) {
    setRows(prev => prev.map(r => r.sow.id === sowId ? { ...r, escalationRate: rate } : r))
  }

  function applyGlobalProfile(profileName: string) {
    const profile = DEFAULT_PROFILES.find(p => p.name === profileName)
    if (!profile) return
    setGlobalProfile(profileName)
    if (profile.name === 'Custom') {
      applyCustomMarkup(customMarkup)
      return
    }
    setRows(prev => prev.map(r => {
      const type = profile.type === 'none' ? 'percentage' as const : profile.type
      const value = profile.value
      const supplierTotal = calculateSupplierTotal(r.subCost, type, value, r.additionalCosts)
      return { ...r, markupType: type, markupValue: value, supplierTotal }
    }))
  }

  function applyCustomMarkup(pct: number) {
    setCustomMarkup(pct)
    setRows(prev => prev.map(r => {
      const supplierTotal = calculateSupplierTotal(r.subCost, 'percentage', pct, r.additionalCosts)
      return { ...r, markupType: 'percentage', markupValue: pct, supplierTotal }
    }))
  }

  function applyGlobalEscalation(rate: number) {
    setGlobalEscalation(rate)
    setRows(prev => prev.map(r => ({ ...r, escalationRate: rate })))
  }

  function calculateOptionYearPrice(baseAnnual: number, escalationRate: number, yearOffset: number): number {
    return Math.round(baseAnnual * Math.pow(1 + escalationRate / 100, yearOffset))
  }

  // Totals
  const totals = useMemo(() => {
    const totalSubCost = rows.reduce((sum, r) => sum + r.subCost, 0)
    const totalSupplier = rows.reduce((sum, r) => sum + r.supplierTotal, 0)
    const totalMarkup = totalSupplier - totalSubCost
    const marginPct = totalSupplier > 0 ? (totalMarkup / totalSupplier) * 100 : 0
    const totalAdditional = rows.reduce((sum, r) => sum + r.additionalCosts, 0)
    const sowsWithQuotes = rows.filter(r => r.quotes.length > 0).length
    const sowsWithSelection = rows.filter(r => r.selectedQuoteId).length

    // Option year calculations
    const esc = globalEscalation === -1 ? customEscalation : globalEscalation
    const baseYearTotal = totalSupplier
    const optionYear1 = Math.round(baseYearTotal * Math.pow(1 + esc / 100, popYears.base))
    const optionYear2 = Math.round(baseYearTotal * Math.pow(1 + esc / 100, popYears.base + popYears.options[0]))

    // Total contract value
    const basePeriodTotal = baseYearTotal * popYears.base
    const opt1Total = optionYear1 * popYears.options[0]
    const opt2Total = popYears.options.length > 1 ? optionYear2 * popYears.options[1] : 0
    const totalContractValue = basePeriodTotal + opt1Total + opt2Total

    return { totalSubCost, totalSupplier, totalMarkup, marginPct, totalAdditional, sowsWithQuotes, sowsWithSelection, baseYearTotal, optionYear1, optionYear2, basePeriodTotal, opt1Total, opt2Total, totalContractValue }
  }, [rows, globalEscalation, customEscalation, popYears])

  async function handleSave() {
    for (const r of rows) {
      if (r.selectedSubId && r.selectedQuoteId) {
        await supabase.from('sow_items').update({
          awarded_subcontractor_id: r.selectedSubId,
          awarded_amount: r.supplierTotal,
          status: 'awarded',
          notes: `Sub cost: ${formatCurrency(r.subCost)} | Markup: ${r.markupType === 'percentage' ? formatPct(r.markupValue) : r.markupType === 'dollar' ? formatCurrency(r.markupValue) : 'Manual'} | Supplier total: ${formatCurrency(r.supplierTotal)}${r.additionalCosts ? ` | Additional: ${formatCurrency(r.additionalCosts)} (${r.additionalCostsNote})` : ''}`,
        }).eq('id', r.sow.id)

        await supabase.from('sow_quotes').update({ status: 'accepted' }).eq('id', r.selectedQuoteId)
      }
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading pricing data...</div>
  }

  if (!taskOrder) {
    return <div className="p-8 text-center text-red-500">Task order not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/projects/${taskOrderId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft size={14} /> Back to Project
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Decision Matrix</h1>
          <p className="text-sm text-gray-500">{taskOrder.title} — {taskOrder.site_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchData()} className="text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
            <RotateCcw size={14} /> Refresh
          </button>
          <button onClick={handleSave} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
            <Save size={14} /> {saved ? 'Saved!' : 'Save Selections'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Sub Cost</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(totals.totalSubCost)}</div>
          <div className="text-xs text-gray-400">{totals.sowsWithSelection} of {rows.length} SOWs selected</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Supplier Price</div>
          <div className="text-xl font-bold text-blue-700">{formatCurrency(totals.totalSupplier)}</div>
          <div className="text-xs text-gray-400">Base year annual</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Margin</div>
          <div className="text-xl font-bold text-green-700">{formatCurrency(totals.totalMarkup)}</div>
          <div className="text-xs text-gray-400">{formatPct(totals.marginPct)} gross margin</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Contract Value</div>
          <div className="text-xl font-bold text-purple-700">{formatCurrency(totals.totalContractValue)}</div>
          <div className="text-xs text-gray-400">{popYears.base + popYears.options.reduce((a, b) => a + b, 0)} years incl. options</div>
        </div>
      </div>

      {/* Global Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Calculator size={16} /> Global Pricing Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Markup Profile */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Apply Markup Profile to All SOWs</label>
            <div className="flex gap-2">
              <select
                value={globalProfile}
                onChange={(e) => applyGlobalProfile(e.target.value)}
                className={`${globalProfile === 'Custom' ? 'flex-1' : 'w-full'} text-sm border border-gray-300 rounded-lg px-3 py-2`}
              >
                {DEFAULT_PROFILES.map(p => (
                  <option key={p.name} value={p.name}>{p.name} — {p.description}</option>
                ))}
              </select>
              {globalProfile === 'Custom' && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={customMarkup}
                    onChange={(e) => applyCustomMarkup(Number(e.target.value))}
                    className="w-20 text-sm border border-gray-300 rounded-lg px-2 py-2 text-center"
                    placeholder="%"
                    min={0}
                    max={100}
                    step={0.5}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              )}
            </div>
          </div>
          {/* Escalation Rate */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Option Year Escalation Rate</label>
            <div className="flex gap-2">
              <select
                value={globalEscalation}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  applyGlobalEscalation(v)
                }}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                {ESCALATION_RATES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {globalEscalation === -1 && (
                <input
                  type="number"
                  value={customEscalation}
                  onChange={(e) => { setCustomEscalation(Number(e.target.value)); applyGlobalEscalation(-1) }}
                  className="w-20 text-sm border border-gray-300 rounded-lg px-2 py-2"
                  placeholder="%"
                  step={0.5}
                />
              )}
            </div>
          </div>
          {/* PoP Structure */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">PoP Structure (years)</label>
            <div className="flex gap-2 items-center text-sm">
              <span className="text-gray-500">Base:</span>
              <input
                type="number"
                value={popYears.base}
                onChange={(e) => setPopYears(prev => ({ ...prev, base: Number(e.target.value) }))}
                className="w-14 border border-gray-300 rounded px-2 py-1 text-center"
                min={1}
              />
              <span className="text-gray-500">Opt 1:</span>
              <input
                type="number"
                value={popYears.options[0]}
                onChange={(e) => setPopYears(prev => ({ ...prev, options: [Number(e.target.value), prev.options[1] || 0] }))}
                className="w-14 border border-gray-300 rounded px-2 py-1 text-center"
                min={0}
              />
              <span className="text-gray-500">Opt 2:</span>
              <input
                type="number"
                value={popYears.options[1] || 0}
                onChange={(e) => setPopYears(prev => ({ ...prev, options: [prev.options[0], Number(e.target.value)] }))}
                className="w-14 border border-gray-300 rounded px-2 py-1 text-center"
                min={0}
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Pricing Suggestion */}
      {taskOrder && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <TrendingUp size={16} /> AI-Suggested Markup
          </h3>
          <p className="text-xs text-amber-700 mb-2">
            Based on project type ({taskOrder.project_type || 'government'}), set-aside ({taskOrder.set_aside || 'full and open'}), and estimated value ({taskOrder.estimated_value || 'unknown'}):
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-900">
                {taskOrder.set_aside && taskOrder.set_aside !== 'none'
                  ? '8-12%'
                  : taskOrder.project_type === 'facilities_management'
                  ? '10-15%'
                  : '10-12%'}
              </span>
              <span className="text-xs text-amber-600">recommended range</span>
            </div>
            <button
              onClick={() => {
                const suggested = taskOrder.set_aside && taskOrder.set_aside !== 'none' ? 10 : 12
                applyCustomMarkup(suggested)
                setGlobalProfile('Custom')
              }}
              className="text-xs px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Apply Suggestion
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-2 italic">
            {taskOrder.set_aside && taskOrder.set_aside !== 'none'
              ? 'Set-aside contracts typically have tighter margins due to competition among small businesses.'
              : 'Full and open competition supports standard industry markup of 10-15% for facilities management.'}
          </p>
        </div>
      )}

      {/* Option Year Pricing Summary */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-4">
        <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2"><TrendingUp size={16} /> Option Year Pricing Projections</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-purple-600 mb-1">Base Period ({popYears.base} yr)</div>
            <div className="text-lg font-bold text-purple-900">{formatCurrency(totals.baseYearTotal)}<span className="text-xs font-normal text-purple-600">/yr</span></div>
            <div className="text-xs text-purple-500">Total: {formatCurrency(totals.basePeriodTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-purple-600 mb-1">Option Period 1 ({popYears.options[0]} yr)</div>
            <div className="text-lg font-bold text-purple-900">{formatCurrency(totals.optionYear1)}<span className="text-xs font-normal text-purple-600">/yr</span></div>
            <div className="text-xs text-purple-500">Total: {formatCurrency(totals.opt1Total)}</div>
          </div>
          {popYears.options[1] > 0 && (
            <div>
              <div className="text-xs text-purple-600 mb-1">Option Period 2 ({popYears.options[1]} yr)</div>
              <div className="text-lg font-bold text-purple-900">{formatCurrency(totals.optionYear2)}<span className="text-xs font-normal text-purple-600">/yr</span></div>
              <div className="text-xs text-purple-500">Total: {formatCurrency(totals.opt2Total)}</div>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-purple-200 text-center">
          <div className="text-xs text-purple-600">Total Contract Value (All Periods)</div>
          <div className="text-2xl font-bold text-purple-900">{formatCurrency(totals.totalContractValue)}</div>
          <div className="text-xs text-purple-500">at {formatPct(globalEscalation === -1 ? customEscalation : globalEscalation)} annual escalation</div>
        </div>
      </div>

      {/* SOW Pricing Rows */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">SOW-by-SOW Pricing ({rows.length} items)</h3>
        {rows.map((row) => {
          const isExpanded = expandedRow === row.sow.id
          const hasQuotes = row.quotes.length > 0
          const margin = row.supplierTotal > 0 ? ((row.supplierTotal - row.subCost) / row.supplierTotal) * 100 : 0
          const esc = row.escalationRate
          const opt1Annual = calculateOptionYearPrice(row.supplierTotal, esc, popYears.base)
          const opt2Annual = calculateOptionYearPrice(row.supplierTotal, esc, popYears.base + popYears.options[0])

          return (
            <div key={row.sow.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Summary Row */}
              <div
                className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedRow(isExpanded ? null : row.sow.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">{row.sow.sow_name}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{row.sow.service_category}</span>
                    {hasQuotes ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 size={10} /> {row.quotes.length} quote{row.quotes.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle size={10} /> No quotes
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right w-24">
                    <div className="text-xs text-gray-400">Sub Cost</div>
                    <div className="font-medium text-gray-700">{formatCurrency(row.subCost)}</div>
                  </div>
                  <div className="text-right w-24">
                    <div className="text-xs text-gray-400">Markup</div>
                    <div className="font-medium text-gray-700">
                      {row.markupType === 'percentage' ? formatPct(row.markupValue) : row.markupType === 'dollar' ? formatCurrency(row.markupValue) : 'Manual'}
                    </div>
                  </div>
                  <div className="text-right w-28">
                    <div className="text-xs text-gray-400">Supplier Total</div>
                    <div className="font-bold text-blue-700">{formatCurrency(row.supplierTotal)}</div>
                  </div>
                  <div className="text-right w-20">
                    <div className="text-xs text-gray-400">Margin</div>
                    <div className={`font-medium ${margin >= 10 ? 'text-green-600' : margin >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{formatPct(margin)}</div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-gray-200 px-4 py-4 space-y-4 bg-gray-50">
                  {/* Quote Comparison Table */}
                  {hasQuotes ? (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">Subcontractor Quotes — Select Winner</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 border-b">
                              <th className="text-left py-2 px-2">Select</th>
                              <th className="text-left py-2 px-2">Subcontractor</th>
                              <th className="text-right py-2 px-2">Total</th>
                              <th className="text-right py-2 px-2">Monthly</th>
                              <th className="text-right py-2 px-2">Annual</th>
                              <th className="text-right py-2 px-2">Labor</th>
                              <th className="text-right py-2 px-2">Materials</th>
                              <th className="text-left py-2 px-2">Exclusions</th>
                              <th className="text-left py-2 px-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.quotes.map(q => (
                              <tr
                                key={q.id}
                                className={`border-b hover:bg-blue-50 cursor-pointer ${q.id === row.selectedQuoteId ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}
                                onClick={() => selectQuote(row.sow.id, q.id, q.subcontractor_id, q.total_amount || 0, q.annual_amount)}
                              >
                                <td className="py-2 px-2">
                                  <input
                                    type="radio"
                                    name={`quote-${row.sow.id}`}
                                    checked={q.id === row.selectedQuoteId}
                                    onChange={() => selectQuote(row.sow.id, q.id, q.subcontractor_id, q.total_amount || 0, q.annual_amount)}
                                    className="accent-blue-600"
                                  />
                                </td>
                                <td className="py-2 px-2 font-medium">{q.subcontractor_name}</td>
                                <td className="py-2 px-2 text-right font-medium">{formatCurrency(q.total_amount)}</td>
                                <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(q.monthly_amount)}</td>
                                <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(q.annual_amount)}</td>
                                <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(q.labor_cost)}</td>
                                <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(q.materials_cost)}</td>
                                <td className="py-2 px-2 text-xs text-gray-500 max-w-[200px] truncate">{q.scope_exclusions || '—'}</td>
                                <td className="py-2 px-2">
                                  <span className={`text-xs px-2 py-0.5 rounded ${q.status === 'accepted' ? 'bg-green-100 text-green-700' : q.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                    {q.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-gray-500 bg-yellow-50 rounded-lg">
                      <AlertTriangle size={20} className="mx-auto mb-1 text-yellow-500" />
                      No quotes received for this SOW. Add subcontractor quotes from the SOW Bid Management section.
                    </div>
                  )}

                  {/* Markup Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Markup Type</label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateMarkup(row.sow.id, 'percentage', row.markupType === 'percentage' ? row.markupValue : 10)}
                          className={`flex-1 text-xs py-2 rounded-lg border flex items-center justify-center gap-1 ${row.markupType === 'percentage' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                          <Percent size={12} /> Percentage
                        </button>
                        <button
                          onClick={() => updateMarkup(row.sow.id, 'dollar', row.markupType === 'dollar' ? row.markupValue : 5000)}
                          className={`flex-1 text-xs py-2 rounded-lg border flex items-center justify-center gap-1 ${row.markupType === 'dollar' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                          <DollarSign size={12} /> Dollar
                        </button>
                        <button
                          onClick={() => updateMarkup(row.sow.id, 'manual', row.supplierTotal)}
                          className={`flex-1 text-xs py-2 rounded-lg border flex items-center justify-center gap-1 ${row.markupType === 'manual' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                          Manual
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        {row.markupType === 'percentage' ? 'Markup %' : row.markupType === 'dollar' ? 'Markup Amount ($)' : 'Supplier Total ($)'}
                      </label>
                      <div className="flex items-center gap-2">
                        {row.markupType === 'percentage' && <Percent size={14} className="text-gray-400" />}
                        {row.markupType === 'dollar' && <DollarSign size={14} className="text-gray-400" />}
                        <input
                          type="number"
                          value={row.markupValue}
                          onChange={(e) => updateMarkup(row.sow.id, row.markupType, Number(e.target.value))}
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                          step={row.markupType === 'percentage' ? 0.5 : 100}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Additional Costs ($)</label>
                      <input
                        type="number"
                        value={row.additionalCosts || ''}
                        onChange={(e) => updateAdditionalCosts(row.sow.id, Number(e.target.value), row.additionalCostsNote)}
                        placeholder="0"
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-1"
                      />
                      <input
                        type="text"
                        value={row.additionalCostsNote}
                        onChange={(e) => updateAdditionalCosts(row.sow.id, row.additionalCosts, e.target.value)}
                        placeholder="Note (e.g., QC overhead, mgmt time)"
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-500"
                      />
                    </div>
                  </div>

                  {/* Cost Buildup */}
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <h4 className="text-xs font-semibold text-gray-600 mb-2">Cost Buildup</h4>
                    <div className="grid grid-cols-5 gap-2 text-sm">
                      <div className="text-center">
                        <div className="text-xs text-gray-400">Sub Cost</div>
                        <div className="font-medium">{formatCurrency(row.subCost)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">+ Markup</div>
                        <div className="font-medium text-green-600">
                          {formatCurrency(row.markupType === 'manual' ? row.markupValue - row.subCost - row.additionalCosts : row.markupType === 'percentage' ? row.subCost * (row.markupValue / 100) : row.markupValue)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">+ Additional</div>
                        <div className="font-medium text-orange-600">{formatCurrency(row.additionalCosts)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">= Supplier Total</div>
                        <div className="font-bold text-blue-700">{formatCurrency(row.supplierTotal)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-400">Margin</div>
                        <div className={`font-bold ${margin >= 10 ? 'text-green-600' : margin >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{formatPct(margin)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Option Year Pricing for this SOW */}
                  <div className="bg-purple-50 rounded-lg border border-purple-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-purple-700">Option Year Pricing</h4>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-purple-600">Escalation:</span>
                        <input
                          type="number"
                          value={row.escalationRate}
                          onChange={(e) => updateEscalation(row.sow.id, Number(e.target.value))}
                          className="w-14 border border-purple-300 rounded px-2 py-0.5 text-center text-xs"
                          step={0.5}
                        />
                        <span className="text-purple-600">%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm text-center">
                      <div>
                        <div className="text-xs text-purple-500">Base Year</div>
                        <div className="font-medium text-purple-800">{formatCurrency(row.supplierTotal)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-purple-500">Option 1 (Yr {popYears.base + 1})</div>
                        <div className="font-medium text-purple-800">{formatCurrency(opt1Annual)}</div>
                      </div>
                      {popYears.options[1] > 0 && (
                        <div>
                          <div className="text-xs text-purple-500">Option 2 (Yr {popYears.base + popYears.options[0] + 1})</div>
                          <div className="font-medium text-purple-800">{formatCurrency(opt2Annual)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Margin Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Margin Analysis Summary</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="text-left py-2">SOW</th>
              <th className="text-right py-2">Sub Cost</th>
              <th className="text-right py-2">Markup</th>
              <th className="text-right py-2">Additional</th>
              <th className="text-right py-2">Supplier Total</th>
              <th className="text-right py-2">Margin $</th>
              <th className="text-right py-2">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const m = r.supplierTotal - r.subCost
              const mPct = r.supplierTotal > 0 ? (m / r.supplierTotal) * 100 : 0
              return (
                <tr key={r.sow.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 font-medium">{r.sow.sow_name}</td>
                  <td className="py-2 text-right">{formatCurrency(r.subCost)}</td>
                  <td className="py-2 text-right text-green-600">
                    {r.markupType === 'percentage' ? formatPct(r.markupValue) : r.markupType === 'dollar' ? formatCurrency(r.markupValue) : 'Manual'}
                  </td>
                  <td className="py-2 text-right text-orange-600">{r.additionalCosts > 0 ? formatCurrency(r.additionalCosts) : '—'}</td>
                  <td className="py-2 text-right font-medium text-blue-700">{formatCurrency(r.supplierTotal)}</td>
                  <td className="py-2 text-right text-green-600">{formatCurrency(m)}</td>
                  <td className={`py-2 text-right font-medium ${mPct >= 10 ? 'text-green-600' : mPct >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{formatPct(mPct)}</td>
                </tr>
              )
            })}
            <tr className="bg-gray-50 font-bold">
              <td className="py-2">TOTALS</td>
              <td className="py-2 text-right">{formatCurrency(totals.totalSubCost)}</td>
              <td className="py-2 text-right text-green-600">{formatCurrency(totals.totalMarkup)}</td>
              <td className="py-2 text-right text-orange-600">{totals.totalAdditional > 0 ? formatCurrency(totals.totalAdditional) : '—'}</td>
              <td className="py-2 text-right text-blue-700">{formatCurrency(totals.totalSupplier)}</td>
              <td className="py-2 text-right text-green-600">{formatCurrency(totals.totalMarkup)}</td>
              <td className={`py-2 text-right ${totals.marginPct >= 10 ? 'text-green-600' : totals.marginPct >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>{formatPct(totals.marginPct)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
