import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadAiOutput } from '../lib/aiStorage'
import type { TaskOrder, ComplianceItem, ExecutiveSummary, RfqPackage, ClarificationQuestion, PricingRisk, AnalysisResult } from '../lib/types'
import { Download, ArrowLeft, FileSpreadsheet, FileText, Presentation } from 'lucide-react'

export default function ExportCenter() {
  const { id } = useParams<{ id: string }>()
  const [taskOrder, setTaskOrder] = useState<TaskOrder | null>(null)
  const [aiStatus, setAiStatus] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    if (id) {
      supabase.from('task_orders').select('*').eq('id', id).single().then(({ data }) => setTaskOrder(data))
      checkOutputs()
    }
  }, [id])

  async function checkOutputs() {
    if (!id) return
    const types = ['analysis', 'compliance_matrix', 'rfq_packages', 'clarification_questions', 'pricing_risks', 'executive_summary']
    const status: Record<string, boolean> = {}
    for (const t of types) {
      const data = await loadAiOutput(id, t)
      status[t] = !!data
    }
    setAiStatus(status)
    setLoading(false)
  }

  async function exportComplianceMatrixExcel() {
    if (!id) return
    setExporting('compliance_excel')
    try {
      const data = await loadAiOutput<{ items: ComplianceItem[] }>(id, 'compliance_matrix')
      if (!data?.items) { alert('No compliance matrix data'); return }

      const XLSX = await import('xlsx')
      const rows = data.items.map(item => ({
        'Requirement': item.requirement,
        'Source Document': item.source_document,
        'Page/Section': item.page_section,
        'Service Category': item.service_category,
        'Responsible Party': item.responsible_party,
        'Proposal Response': item.proposal_response_needed ? 'Yes' : 'No',
        'Pricing Impact': item.pricing_impact,
        'Risk Level': item.risk_level,
        'Status': item.status,
        'Notes': item.notes,
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Compliance Matrix')
      XLSX.writeFile(wb, `Compliance_Matrix_${taskOrder?.title?.replace(/\s+/g, '_') || 'export'}.xlsx`)
    } finally {
      setExporting('')
    }
  }

  async function exportQuoteComparisonExcel() {
    if (!id) return
    setExporting('quote_excel')
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('task_order_id', id)
        .eq('category', 'subcontractor_quote')

      if (!docs?.length) { alert('No subcontractor quotes uploaded'); return }

      const XLSX = await import('xlsx')
      const rows = docs.map(doc => ({
        'File Name': doc.file_name,
        'Uploaded': new Date(doc.uploaded_at).toLocaleDateString(),
        'Size (KB)': (doc.file_size / 1024).toFixed(0),
        'Category': doc.file_name.match(/^\[(.+?)\]/)?.[1] || 'Uncategorized',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Quote Comparison')
      XLSX.writeFile(wb, `Quote_Comparison_${taskOrder?.title?.replace(/\s+/g, '_') || 'export'}.xlsx`)
    } finally {
      setExporting('')
    }
  }

  async function exportExecutiveSummaryPdf() {
    if (!id) return
    setExporting('exec_pdf')
    try {
      const data = await loadAiOutput<ExecutiveSummary>(id, 'executive_summary')
      if (!data) { alert('No executive summary data'); return }

      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      let y = 20

      doc.setFontSize(16)
      doc.text('Executive Bid Summary', 20, y); y += 10
      doc.setFontSize(10)
      doc.text(`Task Order: ${taskOrder?.title || ''}`, 20, y); y += 6
      doc.text(`Site: ${taskOrder?.site_name || ''}`, 20, y); y += 6
      doc.text(`Confidence: ${data.confidence_rating?.toUpperCase()}`, 20, y); y += 10

      doc.setFontSize(12)
      doc.text('Overview', 20, y); y += 6
      doc.setFontSize(9)
      const overviewLines = doc.splitTextToSize(data.overview || '', 170)
      doc.text(overviewLines, 20, y); y += overviewLines.length * 4 + 6

      if (data.major_risks?.length) {
        doc.setFontSize(12)
        doc.text('Major Risks', 20, y); y += 6
        doc.setFontSize(9)
        for (const risk of data.major_risks) {
          if (y > 270) { doc.addPage(); y = 20 }
          doc.text(`[${risk.severity}] ${risk.risk}`, 20, y); y += 4
          const mitLines = doc.splitTextToSize(`Mitigation: ${risk.mitigation}`, 160)
          doc.text(mitLines, 25, y); y += mitLines.length * 4 + 2
        }
      }

      if (data.bid_strategy) {
        y += 4
        if (y > 260) { doc.addPage(); y = 20 }
        doc.setFontSize(12)
        doc.text('Bid Strategy', 20, y); y += 6
        doc.setFontSize(9)
        const stratLines = doc.splitTextToSize(data.bid_strategy, 170)
        doc.text(stratLines, 20, y)
      }

      doc.save(`Executive_Summary_${taskOrder?.title?.replace(/\s+/g, '_') || 'export'}.pdf`)
    } finally {
      setExporting('')
    }
  }

  async function exportRfqPackagesPdf() {
    if (!id) return
    setExporting('rfq_pdf')
    try {
      const data = await loadAiOutput<{ packages: RfqPackage[] }>(id, 'rfq_packages')
      if (!data?.packages?.length) { alert('No RFQ packages data'); return }

      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()

      for (let pi = 0; pi < data.packages.length; pi++) {
        if (pi > 0) doc.addPage()
        const pkg = data.packages[pi]
        let y = 20

        doc.setFontSize(14)
        doc.text(`Subcontractor RFQ: ${pkg.service_category}`, 20, y); y += 8
        doc.setFontSize(10)
        doc.text(`Task Order: ${taskOrder?.title || ''}`, 20, y); y += 10

        const sections = [
          ['Scope Summary', pkg.scope_summary],
          ['Required Frequency', pkg.required_frequency],
          ['Site Assumptions', pkg.site_assumptions],
          ['Equipment / Area Details', pkg.equipment_details],
          ['Required Licenses & Certifications', pkg.licenses_certifications],
          ['Due Date for Quotes', pkg.due_date_note],
          ['Quote Format', pkg.quote_format],
          ['Sales Tax Treatment', pkg.sales_tax_treatment],
        ]

        doc.setFontSize(9)
        for (const [title, content] of sections) {
          if (y > 260) { doc.addPage(); y = 20 }
          doc.setFontSize(10)
          doc.text(title, 20, y); y += 5
          doc.setFontSize(9)
          const lines = doc.splitTextToSize(content || '', 170)
          doc.text(lines, 20, y); y += lines.length * 4 + 4
        }
      }

      doc.save(`RFQ_Packages_${taskOrder?.title?.replace(/\s+/g, '_') || 'export'}.pdf`)
    } finally {
      setExporting('')
    }
  }

  async function exportClarificationsExcel() {
    if (!id) return
    setExporting('clarifications_excel')
    try {
      const data = await loadAiOutput<{ questions: ClarificationQuestion[] }>(id, 'clarification_questions')
      if (!data?.questions?.length) { alert('No clarification questions data'); return }

      const XLSX = await import('xlsx')
      const rows = data.questions.map((q, i) => ({
        '#': i + 1,
        'Question': q.question,
        'Category': q.category,
        'Priority': q.priority,
        'Source Document': q.source_document,
        'Section': q.section_reference,
        'Impact': q.impact,
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Clarification Questions')
      XLSX.writeFile(wb, `Clarification_Questions_${taskOrder?.title?.replace(/\s+/g, '_') || 'export'}.xlsx`)
    } finally {
      setExporting('')
    }
  }

  async function exportPresentationPptx() {
    if (!id) return
    setExporting('presentation_pptx')
    try {
      const execData = await loadAiOutput<ExecutiveSummary>(id, 'executive_summary')
      const analysisData = await loadAiOutput<AnalysisResult>(id, 'analysis')
      if (!execData) { alert('No executive summary data - run AI analysis first'); return }

      const PptxGenJS = (await import('pptxgenjs')).default
      const pptx = new PptxGenJS()
      pptx.author = 'Procuvex — Core314 Technologies LLC'
      pptx.title = `Task Order Analysis - ${taskOrder?.title || ''}`

      // Title slide
      const slide1 = pptx.addSlide()
      slide1.addText('Task Order Analysis', { x: 0.5, y: 1, w: 9, h: 1.5, fontSize: 32, bold: true, color: '1e3a5f', align: 'center' })
      slide1.addText(taskOrder?.title || '', { x: 0.5, y: 2.5, w: 9, h: 0.8, fontSize: 20, color: '4a5568', align: 'center' })
      slide1.addText(`Site: ${taskOrder?.site_name || 'N/A'} | ${taskOrder?.location_city || ''}, ${taskOrder?.location_state || ''}`, { x: 0.5, y: 3.3, w: 9, h: 0.5, fontSize: 14, color: '718096', align: 'center' })
      slide1.addText('Core314 Technologies LLC', { x: 0.5, y: 4.5, w: 9, h: 0.5, fontSize: 12, color: 'a0aec0', align: 'center' })
      slide1.addText(`Confidence: ${execData.confidence_rating?.toUpperCase() || 'N/A'}`, { x: 0.5, y: 5, w: 9, h: 0.5, fontSize: 14, bold: true, color: execData.confidence_rating === 'high' ? '38a169' : execData.confidence_rating === 'medium' ? 'dd6b20' : 'e53e3e', align: 'center' })

      // Overview slide
      const slide2 = pptx.addSlide()
      slide2.addText('Executive Overview', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: '1e3a5f' })
      slide2.addText(execData.overview || '', { x: 0.5, y: 1, w: 9, h: 4, fontSize: 12, color: '4a5568', valign: 'top' })

      // Scope Categories
      if (analysisData?.service_categories?.length) {
        const slide3 = pptx.addSlide()
        slide3.addText('Scope Categories', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: '1e3a5f' })
        const catRows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
          [{ text: 'Category', options: { bold: true, fill: { color: '1e3a5f' }, color: 'ffffff' } }, { text: 'Description', options: { bold: true, fill: { color: '1e3a5f' }, color: 'ffffff' } }, { text: 'Sub-Heavy', options: { bold: true, fill: { color: '1e3a5f' }, color: 'ffffff' } }]
        ]
        for (const cat of analysisData.service_categories) {
          catRows.push([
            { text: cat.category },
            { text: cat.description },
            { text: cat.subcontractor_heavy ? 'Yes' : 'No' },
          ])
        }
        slide3.addTable(catRows, { x: 0.5, y: 1, w: 9, fontSize: 10, border: { pt: 0.5, color: 'cccccc' }, colW: [2.5, 5, 1.5] })
      }

      // Risks slide
      if (execData.major_risks?.length) {
        const slide4 = pptx.addSlide()
        slide4.addText('Key Risks', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: '1e3a5f' })
        const riskRows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
          [{ text: 'Risk', options: { bold: true, fill: { color: 'e53e3e' }, color: 'ffffff' } }, { text: 'Severity', options: { bold: true, fill: { color: 'e53e3e' }, color: 'ffffff' } }, { text: 'Mitigation', options: { bold: true, fill: { color: 'e53e3e' }, color: 'ffffff' } }]
        ]
        for (const r of execData.major_risks) {
          riskRows.push([{ text: r.risk }, { text: r.severity }, { text: r.mitigation }])
        }
        slide4.addTable(riskRows, { x: 0.5, y: 1, w: 9, fontSize: 10, border: { pt: 0.5, color: 'cccccc' }, colW: [3, 1.5, 4.5] })
      }

      // Strategy slide
      const slide5 = pptx.addSlide()
      slide5.addText('Bid Strategy', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 24, bold: true, color: '1e3a5f' })
      slide5.addText(execData.bid_strategy || '', { x: 0.5, y: 1, w: 9, h: 3, fontSize: 12, color: '4a5568', valign: 'top' })
      if (execData.action_items?.length) {
        const actionRows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
          [{ text: 'Action', options: { bold: true, fill: { color: '2b6cb0' }, color: 'ffffff' } }, { text: 'Owner', options: { bold: true, fill: { color: '2b6cb0' }, color: 'ffffff' } }, { text: 'Priority', options: { bold: true, fill: { color: '2b6cb0' }, color: 'ffffff' } }]
        ]
        for (const a of execData.action_items) {
          actionRows.push([{ text: a.action }, { text: a.owner }, { text: a.priority }])
        }
        slide5.addTable(actionRows, { x: 0.5, y: 4.2, w: 9, fontSize: 9, border: { pt: 0.5, color: 'cccccc' }, colW: [5, 2, 2] })
      }

      pptx.writeFile({ fileName: `Task_Order_Analysis_${taskOrder?.title?.replace(/\s+/g, '_') || 'export'}.pptx` })
    } finally {
      setExporting('')
    }
  }

  async function exportFullAnalysisExcel() {
    if (!id) return
    setExporting('full_excel')
    try {
      const analysisData = await loadAiOutput<AnalysisResult>(id, 'analysis')
      const complianceData = await loadAiOutput<{ items: ComplianceItem[] }>(id, 'compliance_matrix')
      const questionsData = await loadAiOutput<{ questions: ClarificationQuestion[] }>(id, 'clarification_questions')
      const risksData = await loadAiOutput<{ risks: PricingRisk[] }>(id, 'pricing_risks')

      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      if (analysisData?.requirements?.length) {
        const ws = XLSX.utils.json_to_sheet(analysisData.requirements.map(r => ({
          'Requirement': r.requirement,
          'Source': r.source_document,
          'Section': r.page_section,
          'Category': r.service_category,
          'Frequency': r.frequency,
          'Risk': r.risk_level,
        })))
        XLSX.utils.book_append_sheet(wb, ws, 'Requirements')
      }

      if (complianceData?.items?.length) {
        const ws = XLSX.utils.json_to_sheet(complianceData.items.map(c => ({
          'Requirement': c.requirement,
          'Source': c.source_document,
          'Category': c.service_category,
          'Responsible': c.responsible_party,
          'Risk': c.risk_level,
          'Status': c.status,
        })))
        XLSX.utils.book_append_sheet(wb, ws, 'Compliance Matrix')
      }

      if (questionsData?.questions?.length) {
        const ws = XLSX.utils.json_to_sheet(questionsData.questions.map((q, i) => ({
          '#': i + 1,
          'Question': q.question,
          'Category': q.category,
          'Priority': q.priority,
          'Source': q.source_document,
        })))
        XLSX.utils.book_append_sheet(wb, ws, 'Clarifications')
      }

      if (risksData?.risks?.length) {
        const ws = XLSX.utils.json_to_sheet(risksData.risks.map(r => ({
          'Risk': r.risk,
          'Category': r.category,
          'Severity': r.severity,
          'Action': r.recommended_action,
          'Impact': r.financial_impact,
        })))
        XLSX.utils.book_append_sheet(wb, ws, 'Pricing Risks')
      }

      XLSX.writeFile(wb, `Full_Analysis_${taskOrder?.title?.replace(/\s+/g, '_') || 'export'}.xlsx`)
    } finally {
      setExporting('')
    }
  }

  async function exportPricingRisksExcel() {
    if (!id) return
    setExporting('pricing_excel')
    try {
      const data = await loadAiOutput<{ risks: PricingRisk[] }>(id, 'pricing_risks')
      if (!data?.risks?.length) { alert('No pricing risks data'); return }

      const XLSX = await import('xlsx')
      const rows = data.risks.map(r => ({
        'Risk': r.risk,
        'Category': r.category,
        'Severity': r.severity,
        'Source Document': r.source_document,
        'Section': r.section_reference,
        'Recommended Action': r.recommended_action,
        'Financial Impact': r.financial_impact,
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Pricing Risks')
      XLSX.writeFile(wb, `Pricing_Risks_${taskOrder?.title?.replace(/\s+/g, '_') || 'export'}.xlsx`)
    } finally {
      setExporting('')
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  const exports = [
    { label: 'Compliance Matrix', format: 'Excel (.xlsx)', icon: FileSpreadsheet, action: exportComplianceMatrixExcel, key: 'compliance_matrix', exportKey: 'compliance_excel' },
    { label: 'Quote Comparison', format: 'Excel (.xlsx)', icon: FileSpreadsheet, action: exportQuoteComparisonExcel, key: '', exportKey: 'quote_excel' },
    { label: 'Executive Summary', format: 'PDF', icon: FileText, action: exportExecutiveSummaryPdf, key: 'executive_summary', exportKey: 'exec_pdf' },
    { label: 'Subcontractor RFQ Packages', format: 'PDF', icon: FileText, action: exportRfqPackagesPdf, key: 'rfq_packages', exportKey: 'rfq_pdf' },
    { label: 'Clarification Questions', format: 'Excel (.xlsx)', icon: FileSpreadsheet, action: exportClarificationsExcel, key: 'clarification_questions', exportKey: 'clarifications_excel' },
    { label: 'Pricing Risk Report', format: 'Excel (.xlsx)', icon: FileSpreadsheet, action: exportPricingRisksExcel, key: 'pricing_risks', exportKey: 'pricing_excel' },
    { label: 'Presentation Deck', format: 'PowerPoint (.pptx)', icon: Presentation, action: exportPresentationPptx, key: 'executive_summary', exportKey: 'presentation_pptx' },
    { label: 'Complete Analysis Workbook', format: 'Excel (.xlsx)', icon: FileSpreadsheet, action: exportFullAnalysisExcel, key: 'analysis', exportKey: 'full_excel' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/task-orders/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
          <ArrowLeft size={14} /> Back to {taskOrder?.title || 'Task Order'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="text-emerald-600" size={24} /> Export Center
        </h1>
        <p className="text-sm text-gray-500 mt-1">Download reports in Excel, PDF, PowerPoint, and Word formats</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exports.map(exp => {
          const available = !exp.key || aiStatus[exp.key]
          return (
            <div key={exp.exportKey} className={`bg-white rounded-xl shadow-sm border p-6 ${available ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <exp.icon size={24} className={available ? 'text-emerald-600' : 'text-gray-400'} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{exp.label}</h3>
                    <p className="text-xs text-gray-500">{exp.format}</p>
                  </div>
                </div>
                <button
                  onClick={exp.action}
                  disabled={!available || exporting === exp.exportKey}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Download size={14} />
                  {exporting === exp.exportKey ? 'Exporting...' : 'Download'}
                </button>
              </div>
              {!available && (
                <p className="text-xs text-gray-400 mt-3">Run AI analysis first to generate this export.</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
