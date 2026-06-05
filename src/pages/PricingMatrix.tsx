import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { TaskOrder, SowItem, SowQuote, Subcontractor } from '../lib/types'
import { ArrowLeft, DollarSign, Percent, TrendingUp, CheckCircle2, AlertTriangle, Calculator, Save, RotateCcw, ChevronDown, ChevronUp, Download, FileSpreadsheet, Table2, Scale, Brain, Award, Shield, Printer } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ========== Types ==========
type ActiveTab = 'pricing' | 'comparison' | 'scoring'

interface WeightConfig {
  price: number
  compliance: number
  pastPerformance: number
  certifications: number
}

interface SubSummary {
  subId: string
  subName: string
  totalQuoted: number
  sowsCovered: number
  avgComplianceScore: number | null
  quotesBySow: Map<string, SowQuote & { subcontractor_name: string }>
  weightedScore: number | null
}

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('comparison')
  const [weights, setWeights] = useState<WeightConfig>({ price: 40, compliance: 30, pastPerformance: 20, certifications: 10 })
  const [allSubs, setAllSubs] = useState<Map<string, Subcontractor>>(new Map())

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
    setAllSubs(sMap)

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

  // ========== Side-by-Side Comparison Data ==========
  const comparisonData = useMemo(() => {
    const subMap = new Map<string, SubSummary>()

    for (const row of rows) {
      for (const q of row.quotes) {
        if (!subMap.has(q.subcontractor_id)) {
          subMap.set(q.subcontractor_id, {
            subId: q.subcontractor_id,
            subName: q.subcontractor_name,
            totalQuoted: 0,
            sowsCovered: 0,
            avgComplianceScore: null,
            quotesBySow: new Map(),
            weightedScore: null,
          })
        }
        const entry = subMap.get(q.subcontractor_id)!
        entry.quotesBySow.set(row.sow.id, q)
        entry.totalQuoted += q.total_amount || 0
        entry.sowsCovered += 1
      }
    }

    // Calculate average compliance scores
    for (const [, sub] of subMap) {
      const scores: number[] = []
      for (const [, q] of sub.quotesBySow) {
        if (q.ai_compliance_score != null) scores.push(q.ai_compliance_score)
      }
      sub.avgComplianceScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    }

    // Calculate weighted scores
    const allTotals = Array.from(subMap.values()).map(s => s.totalQuoted).filter(t => t > 0)
    const minTotal = Math.min(...allTotals, Infinity)
    const maxTotal = Math.max(...allTotals, 0)

    for (const [, sub] of subMap) {
      // Price score: lowest = 100, highest = 0 (linear scale)
      const priceScore = maxTotal > minTotal && sub.totalQuoted > 0
        ? Math.round(100 - ((sub.totalQuoted - minTotal) / (maxTotal - minTotal)) * 100)
        : sub.totalQuoted > 0 ? 100 : 0

      // Compliance score from AI
      const complianceScore = sub.avgComplianceScore ?? 0

      // Past performance: check if sub has a past_performance_rating in Subcontractor
      const subRecord = allSubs.get(sub.subId)
      const subFields = subRecord as unknown as Record<string, unknown> | undefined
      const perfScore = subFields?.past_performance_rating
        ? Number(subFields.past_performance_rating)
        : 70 // default baseline

      // Certifications: check if sub has certifications
      const rawCerts = subFields?.certifications
      const certCount = rawCerts
        ? (Array.isArray(rawCerts) ? rawCerts.length : 1)
        : 0
      const certScore = Math.min(certCount * 25, 100)

      sub.weightedScore = Math.round(
        (priceScore * weights.price / 100) +
        (complianceScore * weights.compliance / 100) +
        (perfScore * weights.pastPerformance / 100) +
        (certScore * weights.certifications / 100)
      )
    }

    return Array.from(subMap.values()).sort((a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0))
  }, [rows, weights, allSubs])

  // Stats per SOW
  const sowStats = useMemo(() => {
    const stats = new Map<string, { min: number; max: number; avg: number; median: number; count: number }>()
    for (const row of rows) {
      const amounts = row.quotes.map(q => q.total_amount || 0).filter(a => a > 0).sort((a, b) => a - b)
      if (amounts.length === 0) continue
      const sum = amounts.reduce((a, b) => a + b, 0)
      const mid = Math.floor(amounts.length / 2)
      stats.set(row.sow.id, {
        min: amounts[0],
        max: amounts[amounts.length - 1],
        avg: Math.round(sum / amounts.length),
        median: amounts.length % 2 === 0 ? Math.round((amounts[mid - 1] + amounts[mid]) / 2) : amounts[mid],
        count: amounts.length,
      })
    }
    return stats
  }, [rows])

  // ========== Export Functions ==========
  const exportToExcel = useCallback(() => {
    if (!taskOrder) return
    const wb = XLSX.utils.book_new()

    // Sheet 1: Side-by-Side Comparison
    const compHeaders = ['SOW / Line Item', 'Category', ...comparisonData.map(s => s.subName), 'Lowest', 'Highest', 'Average']
    const compRows: (string | number)[][] = []
    for (const row of rows) {
      const r: (string | number)[] = [row.sow.sow_name, row.sow.service_category]
      for (const sub of comparisonData) {
        const q = sub.quotesBySow.get(row.sow.id)
        r.push(q?.total_amount ?? 'No Quote')
      }
      const st = sowStats.get(row.sow.id)
      r.push(st?.min ?? '—', st?.max ?? '—', st?.avg ?? '—')
      compRows.push(r)
    }
    // Totals row
    const totalsRow: (string | number)[] = ['TOTAL', '']
    for (const sub of comparisonData) totalsRow.push(sub.totalQuoted)
    totalsRow.push('', '', '')
    compRows.push(totalsRow)

    const ws1 = XLSX.utils.aoa_to_sheet([compHeaders, ...compRows])
    ws1['!cols'] = compHeaders.map((_, i) => ({ wch: i === 0 ? 35 : i === 1 ? 18 : 18 }))
    XLSX.utils.book_append_sheet(wb, ws1, 'Quote Comparison')

    // Sheet 2: Weighted Scoring
    const scoreHeaders = ['Subcontractor', 'Total Quoted', 'SOWs Covered', 'Avg Compliance', 'Price Score', 'Compliance Score', 'Weighted Score', 'Rank']
    const scoreRows = comparisonData.map((s, i) => [
      s.subName,
      s.totalQuoted,
      `${s.sowsCovered} / ${rows.length}`,
      s.avgComplianceScore != null ? `${s.avgComplianceScore}%` : 'N/A',
      '', // Price score embedded in weighted
      s.avgComplianceScore != null ? `${s.avgComplianceScore}%` : 'N/A',
      s.weightedScore ?? 'N/A',
      `#${i + 1}`,
    ])
    const ws2 = XLSX.utils.aoa_to_sheet([scoreHeaders, ...scoreRows])
    ws2['!cols'] = scoreHeaders.map(() => ({ wch: 18 }))
    XLSX.utils.book_append_sheet(wb, ws2, 'Weighted Scoring')

    // Sheet 3: Compliance Detail
    const complianceHeaders = ['SOW', 'Subcontractor', 'Compliance Score', 'Missing Requirements', 'Pricing Gaps', 'Status']
    const complianceRows: (string | number)[][] = []
    for (const row of rows) {
      for (const q of row.quotes) {
        const analysis = q.ai_compliance_analysis as Record<string, unknown> | null
        complianceRows.push([
          row.sow.sow_name,
          q.subcontractor_name,
          q.ai_compliance_score != null ? `${q.ai_compliance_score}%` : 'Not Analyzed',
          analysis?.missing_requirements ? String((analysis.missing_requirements as unknown[]).length) : '—',
          analysis?.pricing_gaps ? String((analysis.pricing_gaps as unknown[]).length) : '—',
          q.status,
        ])
      }
    }
    const ws3 = XLSX.utils.aoa_to_sheet([complianceHeaders, ...complianceRows])
    ws3['!cols'] = complianceHeaders.map((_, i) => ({ wch: i === 0 ? 30 : 20 }))
    XLSX.utils.book_append_sheet(wb, ws3, 'AI Compliance Detail')

    // Sheet 4: Pricing Builder (existing markup data)
    const pricingHeaders = ['SOW', 'Selected Sub', 'Sub Cost', 'Markup', 'Additional Costs', 'Supplier Total', 'Margin %']
    const pricingRows = rows.map(r => {
      const selectedSub = r.quotes.find(q => q.id === r.selectedQuoteId)
      const margin = r.supplierTotal > 0 ? ((r.supplierTotal - r.subCost) / r.supplierTotal) * 100 : 0
      return [
        r.sow.sow_name,
        selectedSub?.subcontractor_name || 'None',
        r.subCost,
        r.markupType === 'percentage' ? `${r.markupValue}%` : r.markupType === 'dollar' ? r.markupValue : 'Manual',
        r.additionalCosts,
        r.supplierTotal,
        `${margin.toFixed(1)}%`,
      ]
    })
    const ws4 = XLSX.utils.aoa_to_sheet([pricingHeaders, ...pricingRows])
    ws4['!cols'] = pricingHeaders.map((_, i) => ({ wch: i === 0 ? 30 : 18 }))
    XLSX.utils.book_append_sheet(wb, ws4, 'Pricing Builder')

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `PDM_${taskOrder.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'project'}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }, [taskOrder, rows, comparisonData, sowStats])

  const exportToPDF = useCallback(() => {
    if (!taskOrder) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })

    // Title
    doc.setFontSize(16)
    doc.text('Pricing Decision Matrix', 40, 40)
    doc.setFontSize(10)
    doc.text(`${taskOrder.title} — ${taskOrder.site_name || ''}`, 40, 58)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 72)
    doc.setFontSize(8)
    doc.text(`Weights: Price ${weights.price}% | Compliance ${weights.compliance}% | Past Performance ${weights.pastPerformance}% | Certifications ${weights.certifications}%`, 40, 86)

    // Table 1: Side-by-Side
    const subNames = comparisonData.map(s => s.subName)
    const head1 = [['SOW / Line Item', ...subNames, 'Low', 'High', 'Avg']]
    const body1 = rows.map(row => {
      const cells: string[] = [row.sow.sow_name]
      for (const sub of comparisonData) {
        const q = sub.quotesBySow.get(row.sow.id)
        cells.push(q?.total_amount ? formatCurrency(q.total_amount) : '—')
      }
      const st = sowStats.get(row.sow.id)
      cells.push(st ? formatCurrency(st.min) : '—', st ? formatCurrency(st.max) : '—', st ? formatCurrency(st.avg) : '—')
      return cells
    })

    autoTable(doc, {
      head: head1,
      body: body1,
      startY: 100,
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [49, 46, 129], fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 255] },
    })

    // Table 2: Weighted Scoring
    const docAny = doc as unknown as Record<string, unknown>
    const finalY = docAny.lastAutoTable ? (docAny.lastAutoTable as Record<string, number>).finalY + 20 : 300
    doc.setFontSize(12)
    doc.text('Weighted Scoring Summary', 40, finalY)

    const head2 = [['Rank', 'Subcontractor', 'Total Quoted', 'SOWs', 'Compliance', 'Weighted Score']]
    const body2 = comparisonData.map((s, i) => [
      `#${i + 1}`,
      s.subName,
      formatCurrency(s.totalQuoted),
      `${s.sowsCovered}/${rows.length}`,
      s.avgComplianceScore != null ? `${s.avgComplianceScore}%` : 'N/A',
      s.weightedScore != null ? `${s.weightedScore}/100` : 'N/A',
    ])

    autoTable(doc, {
      head: head2,
      body: body2,
      startY: finalY + 10,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [88, 28, 135], fontSize: 8 },
    })

    doc.save(`PDM_${taskOrder.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'project'}_${new Date().toISOString().split('T')[0]}.pdf`)
  }, [taskOrder, rows, comparisonData, sowStats, weights])

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
          <div className="relative group">
            <button className="text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
              <Download size={14} /> Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 hidden group-hover:block min-w-[180px]">
              <button onClick={exportToExcel} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-green-600" /> Excel Workbook (.xlsx)
              </button>
              <button onClick={exportToPDF} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                <Printer size={14} className="text-red-600" /> PDF Report
              </button>
            </div>
          </div>
          {activeTab === 'pricing' && (
            <button onClick={handleSave} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
              <Save size={14} /> {saved ? 'Saved!' : 'Save Selections'}
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('comparison')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'comparison' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Table2 size={16} /> Quote Comparison
        </button>
        <button
          onClick={() => setActiveTab('scoring')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'scoring' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Scale size={16} /> Weighted Scoring
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'pricing' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Calculator size={16} /> Pricing Builder
        </button>
      </div>

      {/* ==================== COMPARISON TAB ==================== */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Subcontractors</div>
              <div className="text-xl font-bold text-gray-900">{comparisonData.length}</div>
              <div className="text-xs text-gray-400">submitted quotes</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">SOW Line Items</div>
              <div className="text-xl font-bold text-gray-900">{rows.length}</div>
              <div className="text-xs text-gray-400">requiring quotes</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Total Quotes</div>
              <div className="text-xl font-bold text-indigo-700">{rows.reduce((sum, r) => sum + r.quotes.length, 0)}</div>
              <div className="text-xs text-gray-400">received</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Lowest Total Bid</div>
              <div className="text-xl font-bold text-green-700">
                {comparisonData.length > 0 ? formatCurrency(Math.min(...comparisonData.map(s => s.totalQuoted).filter(t => t > 0))) : '—'}
              </div>
              <div className="text-xs text-gray-400">{comparisonData.length > 0 ? comparisonData.reduce((best, s) => s.totalQuoted < best.totalQuoted && s.totalQuoted > 0 ? s : best, comparisonData[0])?.subName : ''}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Best Value</div>
              <div className="text-xl font-bold text-purple-700">
                {comparisonData.length > 0 && comparisonData[0].weightedScore != null ? `${comparisonData[0].weightedScore}/100` : '—'}
              </div>
              <div className="text-xs text-gray-400">{comparisonData.length > 0 ? comparisonData[0].subName : ''}</div>
            </div>
          </div>

          {/* Side-by-Side Comparison Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Table2 size={16} className="text-indigo-600" /> Side-by-Side Quote Comparison</h3>
              <p className="text-xs text-gray-500 mt-0.5">All subcontractor quotes compared across every SOW line item. Green = lowest price, Red = highest.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[220px] z-10">SOW / Line Item</th>
                    {comparisonData.map((sub, idx) => (
                      <th key={sub.subId} className="text-center py-3 px-3 font-semibold min-w-[140px]">
                        <div className="text-gray-700 text-xs">{sub.subName}</div>
                        {sub.avgComplianceScore != null && (
                          <div className={`inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full ${sub.avgComplianceScore >= 80 ? 'bg-green-100 text-green-700' : sub.avgComplianceScore >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            <Brain size={10} /> {sub.avgComplianceScore}%
                          </div>
                        )}
                        {idx === 0 && comparisonData.length > 1 && (
                          <div className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 ml-1">
                            <Award size={10} /> Best Value
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="text-center py-3 px-3 font-semibold text-gray-500 min-w-[90px] bg-gray-100">Low</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-500 min-w-[90px] bg-gray-100">High</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-500 min-w-[90px] bg-gray-100">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const st = sowStats.get(row.sow.id)
                    return (
                      <tr key={row.sow.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 sticky left-0 bg-white z-10">
                          <div className="font-medium text-gray-900 text-xs">{row.sow.sow_name}</div>
                          <div className="text-xs text-gray-400">{row.sow.service_category}</div>
                        </td>
                        {comparisonData.map(sub => {
                          const q = sub.quotesBySow.get(row.sow.id)
                          const amt = q?.total_amount || 0
                          const isLowest = st && amt > 0 && amt === st.min
                          const isHighest = st && amt > 0 && amt === st.max && st.count > 1
                          return (
                            <td key={sub.subId} className={`py-3 px-3 text-center ${isLowest ? 'bg-green-50' : isHighest ? 'bg-red-50' : ''}`}>
                              {q ? (
                                <div>
                                  <div className={`font-medium ${isLowest ? 'text-green-700' : isHighest ? 'text-red-600' : 'text-gray-900'}`}>
                                    {formatCurrency(q.total_amount)}
                                  </div>
                                  {q.ai_compliance_score != null && (
                                    <div className={`text-xs mt-0.5 ${q.ai_compliance_score >= 80 ? 'text-green-600' : q.ai_compliance_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                      {q.ai_compliance_score}% compliant
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-xs">No Quote</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="py-3 px-3 text-center bg-gray-50 font-medium text-green-700 text-xs">{st ? formatCurrency(st.min) : '—'}</td>
                        <td className="py-3 px-3 text-center bg-gray-50 font-medium text-red-600 text-xs">{st ? formatCurrency(st.max) : '—'}</td>
                        <td className="py-3 px-3 text-center bg-gray-50 font-medium text-gray-700 text-xs">{st ? formatCurrency(st.avg) : '—'}</td>
                      </tr>
                    )
                  })}
                  {/* Totals Row */}
                  <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200">
                    <td className="py-3 px-4 sticky left-0 bg-indigo-50 z-10 text-indigo-900">TOTAL</td>
                    {comparisonData.map(sub => (
                      <td key={sub.subId} className="py-3 px-3 text-center text-indigo-900">{formatCurrency(sub.totalQuoted)}</td>
                    ))}
                    <td className="py-3 px-3 text-center bg-indigo-100 text-green-700">
                      {comparisonData.length > 0 ? formatCurrency(Math.min(...comparisonData.map(s => s.totalQuoted).filter(t => t > 0))) : '—'}
                    </td>
                    <td className="py-3 px-3 text-center bg-indigo-100 text-red-600">
                      {comparisonData.length > 0 ? formatCurrency(Math.max(...comparisonData.map(s => s.totalQuoted))) : '—'}
                    </td>
                    <td className="py-3 px-3 text-center bg-indigo-100 text-gray-700">
                      {comparisonData.length > 0 ? formatCurrency(Math.round(comparisonData.reduce((s, c) => s + c.totalQuoted, 0) / comparisonData.length)) : '—'}
                    </td>
                  </tr>
                  {/* Coverage Row */}
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <td className="py-2 px-4 sticky left-0 bg-gray-50 z-10">SOW Coverage</td>
                    {comparisonData.map(sub => (
                      <td key={sub.subId} className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full ${sub.sowsCovered === rows.length ? 'bg-green-100 text-green-700' : sub.sowsCovered >= rows.length * 0.7 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                          {sub.sowsCovered}/{rows.length}
                        </span>
                      </td>
                    ))}
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Compliance Overlay */}
          {rows.some(r => r.quotes.some(q => q.ai_compliance_score != null)) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Brain size={16} className="text-green-600" /> AI Compliance Score Overlay</h3>
                <p className="text-xs text-gray-500 mt-0.5">Compliance scores from AI analysis of each quote against SOW requirements.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 min-w-[220px]">SOW / Line Item</th>
                      {comparisonData.map(sub => (
                        <th key={sub.subId} className="text-center py-3 px-3 font-semibold text-gray-700 min-w-[140px] text-xs">{sub.subName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.sow.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900 text-xs">{row.sow.sow_name}</td>
                        {comparisonData.map(sub => {
                          const q = sub.quotesBySow.get(row.sow.id)
                          const score = q?.ai_compliance_score
                          const analysis = q?.ai_compliance_analysis as Record<string, unknown> | null
                          return (
                            <td key={sub.subId} className="py-3 px-3 text-center">
                              {score != null ? (
                                <div>
                                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${score >= 90 ? 'bg-green-100 text-green-800' : score >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                    {score}%
                                  </div>
                                  {analysis?.missing_requirements && Array.isArray(analysis.missing_requirements) && analysis.missing_requirements.length > 0 && (
                                    <div className="text-xs text-red-500 mt-1">{analysis.missing_requirements.length} gap{analysis.missing_requirements.length !== 1 ? 's' : ''}</div>
                                  )}
                                </div>
                              ) : q ? (
                                <span className="text-xs text-gray-400">Not Analyzed</span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {/* Average Row */}
                    <tr className="bg-green-50 font-bold border-t-2 border-green-200">
                      <td className="py-3 px-4 text-green-900">Average Compliance</td>
                      {comparisonData.map(sub => (
                        <td key={sub.subId} className="py-3 px-3 text-center">
                          {sub.avgComplianceScore != null ? (
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${sub.avgComplianceScore >= 80 ? 'bg-green-200 text-green-800' : sub.avgComplianceScore >= 60 ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                              {sub.avgComplianceScore}%
                            </span>
                          ) : <span className="text-gray-400 text-xs">N/A</span>}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== SCORING TAB ==================== */}
      {activeTab === 'scoring' && (
        <div className="space-y-6">
          {/* Weight Configuration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Scale size={16} className="text-purple-600" /> Evaluation Weights (must total 100%)</h3>
            <p className="text-xs text-gray-500 mb-4">Adjust weights per FAR 15.101-1 Best Value evaluation criteria. Industry default: Price 40%, Technical/Compliance 30%, Past Performance 20%, Certifications 10%.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><DollarSign size={12} /> Price Weight</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} value={weights.price} onChange={(e) => setWeights(w => ({ ...w, price: Number(e.target.value) }))} className="flex-1 accent-blue-600" />
                  <span className="text-sm font-bold text-blue-700 w-10 text-right">{weights.price}%</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><Brain size={12} /> Compliance Weight</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} value={weights.compliance} onChange={(e) => setWeights(w => ({ ...w, compliance: Number(e.target.value) }))} className="flex-1 accent-green-600" />
                  <span className="text-sm font-bold text-green-700 w-10 text-right">{weights.compliance}%</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><Award size={12} /> Past Performance</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} value={weights.pastPerformance} onChange={(e) => setWeights(w => ({ ...w, pastPerformance: Number(e.target.value) }))} className="flex-1 accent-amber-600" />
                  <span className="text-sm font-bold text-amber-700 w-10 text-right">{weights.pastPerformance}%</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><Shield size={12} /> Certifications</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} value={weights.certifications} onChange={(e) => setWeights(w => ({ ...w, certifications: Number(e.target.value) }))} className="flex-1 accent-purple-600" />
                  <span className="text-sm font-bold text-purple-700 w-10 text-right">{weights.certifications}%</span>
                </div>
              </div>
            </div>
            {weights.price + weights.compliance + weights.pastPerformance + weights.certifications !== 100 && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Weights total {weights.price + weights.compliance + weights.pastPerformance + weights.certifications}% — should equal 100%
              </div>
            )}
          </div>

          {/* Ranking Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Award size={16} className="text-purple-600" /> Best Value Ranking</h3>
              <p className="text-xs text-gray-500 mt-0.5">Subcontractors ranked by weighted composite score. Higher = better value.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-center py-3 px-3 font-semibold text-gray-700 w-16">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Subcontractor</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Quoted</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700">SOW Coverage</th>
                    <th className="text-center py-3 px-3 font-semibold text-blue-700">Price Score<br /><span className="text-xs font-normal text-gray-400">({weights.price}%)</span></th>
                    <th className="text-center py-3 px-3 font-semibold text-green-700">Compliance<br /><span className="text-xs font-normal text-gray-400">({weights.compliance}%)</span></th>
                    <th className="text-center py-3 px-3 font-semibold text-amber-700">Past Perf.<br /><span className="text-xs font-normal text-gray-400">({weights.pastPerformance}%)</span></th>
                    <th className="text-center py-3 px-3 font-semibold text-purple-700">Certs<br /><span className="text-xs font-normal text-gray-400">({weights.certifications}%)</span></th>
                    <th className="text-center py-3 px-3 font-semibold text-indigo-700">Weighted<br />Score</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((sub, idx) => {
                    const allTotals = comparisonData.map(s => s.totalQuoted).filter(t => t > 0)
                    const minT = Math.min(...allTotals, Infinity)
                    const maxT = Math.max(...allTotals, 0)
                    const priceScore = maxT > minT && sub.totalQuoted > 0 ? Math.round(100 - ((sub.totalQuoted - minT) / (maxT - minT)) * 100) : sub.totalQuoted > 0 ? 100 : 0
                    const subRecord = allSubs.get(sub.subId)
                    const subF = subRecord as unknown as Record<string, unknown> | undefined
                    const perfScore = subF?.past_performance_rating ? Number(subF.past_performance_rating) : 70
                    const rawC = subF?.certifications
                    const certCount = rawC ? (Array.isArray(rawC) ? rawC.length : 1) : 0
                    const certScore = Math.min(certCount * 25, 100)

                    return (
                      <tr key={sub.subId} className={`border-b hover:bg-gray-50 ${idx === 0 ? 'bg-purple-50' : ''}`}>
                        <td className="py-3 px-3 text-center">
                          {idx === 0 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-500 text-white rounded-full font-bold text-sm shadow-sm">1</span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-400 text-white rounded-full font-bold text-sm">2</span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-amber-600 to-amber-700 text-white rounded-full font-bold text-sm">3</span>
                          ) : (
                            <span className="text-gray-500 font-medium">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{sub.subName}</div>
                          {idx === 0 && <div className="text-xs text-purple-600 font-medium mt-0.5">Recommended — Best Value</div>}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">{formatCurrency(sub.totalQuoted)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${sub.sowsCovered === rows.length ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {sub.sowsCovered}/{rows.length}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${priceScore}%` }} /></div>
                            <span className="text-xs font-medium text-gray-600">{priceScore}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${sub.avgComplianceScore ?? 0}%` }} /></div>
                            <span className="text-xs font-medium text-gray-600">{sub.avgComplianceScore ?? 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${perfScore}%` }} /></div>
                            <span className="text-xs font-medium text-gray-600">{perfScore}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${certScore}%` }} /></div>
                            <span className="text-xs font-medium text-gray-600">{certScore}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-sm font-bold ${(sub.weightedScore ?? 0) >= 75 ? 'bg-green-100 text-green-800 ring-2 ring-green-300' : (sub.weightedScore ?? 0) >= 50 ? 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-300' : 'bg-red-100 text-red-800 ring-2 ring-red-300'}`}>
                            {sub.weightedScore ?? '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Weight Explanation */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2"><TrendingUp size={16} /> How Scoring Works (FAR 15.101-1)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-amber-700">
              <div><strong>Price ({weights.price}%):</strong> Lowest total bid = 100 points. Highest = 0. Linear interpolation between.</div>
              <div><strong>Compliance ({weights.compliance}%):</strong> AI-generated compliance score from quote analysis against SOW requirements (0-100).</div>
              <div><strong>Past Performance ({weights.pastPerformance}%):</strong> Historical performance rating from subcontractor profile (default: 70 if unrated).</div>
              <div><strong>Certifications ({weights.certifications}%):</strong> Each relevant certification earns 25 points (max 100).</div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PRICING TAB ==================== */}
      {activeTab === 'pricing' && (<div className="space-y-6">

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
    </div>)}
    </div>
  )
}
