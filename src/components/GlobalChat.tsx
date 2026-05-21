import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, User, Loader2, Sparkles, CheckCircle2, XCircle, FileText, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { parseSmartNotesResponse, getHumanResponse, applyChanges, SMART_NOTES_PROMPT, type SmartNotesResult } from '../lib/smartNotes'
import { loadIntelligence, loadAllDebriefs } from '../lib/debriefStorage'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  proposedChanges?: SmartNotesResult
  changesApplied?: boolean
  changesResult?: { success: number; errors: string[] }
}

const SUGGESTED_QUESTIONS = [
  'How many active projects do we have?',
  'Which projects are missing subcontractor quotes?',
  'How many subcontractors are in our database?',
  'What is the total estimated value across all projects?',
  'Which SOWs across all projects have no quotes?',
  'Summarize our subcontractor coverage by service category.',
]

const SMART_NOTES_SUGGESTIONS = [
  'Here are my notes from today\'s site visit...',
  'I found out that the incumbent for HVAC is...',
  'Add a new subcontractor: [company name]...',
]

export default function GlobalChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function buildContext() {
    const parts: string[] = []
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const fmt = (v: number | string | null | undefined) => {
      if (v == null || v === '') return 'N/A'
      if (typeof v === 'number') return `$${v.toLocaleString()}`
      return String(v)
    }
    const fmtDate = (d: string | null | undefined) => {
      if (!d) return 'N/A'
      try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return d }
    }
    const isToday = (d: string | null | undefined) => {
      if (!d) return false
      try {
        const date = new Date(d)
        return date.getFullYear() === now.getFullYear() &&
               date.getMonth() === now.getMonth() &&
               date.getDate() === now.getDate()
      } catch { return false }
    }
    const isThisWeek = (d: string | null | undefined) => {
      if (!d) return false
      try {
        const date = new Date(d)
        const diffMs = now.getTime() - date.getTime()
        return diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000
      } catch { return false }
    }

    parts.push(`=== CURRENT DATE/TIME: ${now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })} (${todayStr}) ===`)

    // ========== 1. TASK ORDERS (full detail) ==========
    const { data: taskOrders } = await supabase
      .from('task_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (taskOrders && taskOrders.length > 0) {
      parts.push(`=== TASK ORDERS (${taskOrders.length}) ===`)
      for (const to of taskOrders) {
        const lines = [
          `Project: ${to.title}`,
          `  Solicitation: ${to.solicitation_number || 'N/A'} | TO#: ${to.task_order_number || 'N/A'} | Contract#: ${to.contract_number || 'N/A'}`,
          `  Site: ${to.site_name || 'N/A'} | Location: ${to.location_city ? `${to.location_city}, ${to.location_state}` : 'N/A'}`,
          `  Status: ${to.status} | Due: ${to.due_date || to.response_deadline || 'N/A'}`,
          `  Estimated Value: ${to.estimated_value || 'Not specified'}`,
          `  Contract Vehicle: ${to.contract_vehicle || 'N/A'} | NAICS: ${to.naics_code || 'N/A'} | Set-Aside: ${to.set_aside || 'N/A'}`,
          `  Period of Performance: ${to.period_of_performance_start || 'N/A'} to ${to.period_of_performance_end || 'N/A'}`,
          `  Contracting Officer: ${to.contracting_officer || 'N/A'}${to.co_email ? ` (${to.co_email})` : ''}${to.co_phone ? ` ${to.co_phone}` : ''}`,
          `  Created: ${fmtDate(to.created_at)} | Last Updated: ${fmtDate(to.updated_at)}`,
        ]
        if (to.notes) lines.push(`  Notes: ${to.notes}`)
        parts.push(lines.join('\n'))
      }
    } else {
      parts.push('=== TASK ORDERS (0) ===')
      parts.push('No projects have been registered yet.')
    }

    // ========== 2. SOW ITEMS (full detail with financials) ==========
    const { data: sowItems } = await supabase
      .from('sow_items')
      .select('*')
      .order('task_order_id')

    // ========== 3. SUBCONTRACTORS (full detail) ==========
    const { data: subcontractors } = await supabase
      .from('subcontractors')
      .select('*')

    const subLookup: Record<string, string> = {}
    if (subcontractors) {
      for (const s of subcontractors) {
        subLookup[s.id] = s.company_name
      }
    }

    // ========== 4. SOW-SUBCONTRACTOR ASSIGNMENTS ==========
    const { data: sowSubs } = await supabase
      .from('sow_subcontractors')
      .select('*')

    // ========== 5. QUOTES ==========
    const { data: quotes } = await supabase
      .from('sow_quotes')
      .select('*')

    // ========== 6. COMMUNICATIONS ==========
    const { data: comms } = await supabase
      .from('sow_communications')
      .select('*')
      .order('created_at', { ascending: false })

    // ========== 7. DOCUMENTS ==========
    const { data: docs } = await supabase
      .from('documents')
      .select('*')

    // ========== 8. SUBCONTRACTOR QUESTIONS ==========
    const { data: subQuestions } = await supabase
      .from('subcontractor_questions')
      .select('*')

    // ========== 9. EMAIL TRACKING ==========
    const { data: emailTracking } = await supabase
      .from('email_tracking')
      .select('*')

    // ========== 10. RFQ TOKENS ==========
    const { data: rfqTokens } = await supabase
      .from('rfq_tokens')
      .select('*')

    // ========== 11. COMPETITORS ==========
    const { data: competitors } = await supabase
      .from('competitors')
      .select('*')

    // ========== 12. COMPANY PROFILE ==========
    const { data: companyProfile } = await supabase
      .from('company_profile')
      .select('*')
      .limit(1)

    // Build SOW details with all financial data
    if (sowItems && sowItems.length > 0) {
      const byTaskOrder: Record<string, { to: (typeof taskOrders extends (infer T)[] | null ? T : never); sows: typeof sowItems }> = {}
      for (const sow of sowItems) {
        const to = taskOrders?.find(t => t.id === sow.task_order_id)
        const toTitle = to?.title || sow.task_order_id
        if (!byTaskOrder[toTitle]) byTaskOrder[toTitle] = { to: to as any, sows: [] }
        byTaskOrder[toTitle].sows.push(sow)
      }

      parts.push(`\n=== SOW BREAKDOWN BY TASK ORDER ===`)
      for (const [toTitle, { to, sows }] of Object.entries(byTaskOrder)) {
        // Calculate project totals
        const totalEstimated = sows.reduce((sum, s) => {
          const est = s.notes?.match(/Estimated value: \$([\d,]+)/)?.[1]
          return sum + (est ? parseInt(est.replace(/,/g, '')) : 0)
        }, 0)
        const totalAwarded = sows.reduce((sum, s) => sum + (parseFloat(s.awarded_amount) || 0), 0)
        const quoteCount = (quotes || []).filter(q => sows.some(s => s.id === q.sow_item_id)).length

        parts.push(`\n${toTitle}: ${sows.length} SOWs | Est Total: ${totalEstimated > 0 ? fmt(totalEstimated) : (to?.estimated_value || 'Not specified')} | Awarded Total: ${totalAwarded > 0 ? fmt(totalAwarded) : '$0 (not yet awarded)'}  | ${quoteCount} quotes received`)

        for (const sow of sows) {
          const estMatch = sow.notes?.match(/Estimated value: \$([\d,]+)/)
          const estValue = estMatch ? `$${estMatch[1]}` : 'N/A'
          const awardedSub = sow.awarded_subcontractor_id ? (subLookup[sow.awarded_subcontractor_id] || 'Unknown') : null

          let line = `  SOW: ${sow.sow_name} | Category: ${sow.service_category} | Status: ${sow.status} | Estimated: ${estValue}`
          if (sow.awarded_amount) line += ` | Awarded: ${fmt(parseFloat(sow.awarded_amount))}`
          if (awardedSub) line += ` to ${awardedSub}`
          if (sow.description) line += `\n    Description: ${sow.description.substring(0, 200)}`
          if (sow.notes && !estMatch) line += `\n    Notes: ${sow.notes.substring(0, 200)}`

          // Show subcontractors assigned to this SOW
          const assignments = (sowSubs || []).filter(ss => ss.sow_item_id === sow.id)
          if (assignments.length > 0) {
            const assignmentDetails = assignments.map(a => {
              const subName = subLookup[a.subcontractor_id] || 'Unknown'
              let detail = `${subName} (${a.outreach_status})`
              if (a.rfq_sent_date) detail += ` RFQ sent: ${new Date(a.rfq_sent_date).toLocaleDateString()}`
              if (a.email_opened_at) detail += ' [opened]'
              if (a.email_clicked_at) detail += ' [clicked portal]'
              return detail
            }).join('; ')
            line += `\n    Assigned Subs: ${assignmentDetails}`
          }

          // Show quotes for this SOW
          const sowQuotes = (quotes || []).filter(q => q.sow_item_id === sow.id)
          if (sowQuotes.length > 0) {
            for (const q of sowQuotes) {
              const qSub = subLookup[q.subcontractor_id] || 'Unknown'
              let qLine = `    Quote from ${qSub}: Total=${fmt(q.total_amount)}`
              if (q.monthly_amount) qLine += ` Monthly=${fmt(q.monthly_amount)}`
              if (q.annual_amount) qLine += ` Annual=${fmt(q.annual_amount)}`
              if (q.labor_cost) qLine += ` Labor=${fmt(q.labor_cost)}`
              if (q.materials_cost) qLine += ` Materials=${fmt(q.materials_cost)}`
              if (q.equipment_cost) qLine += ` Equipment=${fmt(q.equipment_cost)}`
              if (q.overhead_markup) qLine += ` Markup=${q.overhead_markup}%`
              qLine += ` | Status: ${q.status}`
              if (q.scope_inclusions) qLine += `\n      Inclusions: ${q.scope_inclusions.substring(0, 150)}`
              if (q.scope_exclusions) qLine += `\n      Exclusions: ${q.scope_exclusions.substring(0, 150)}`
              if (q.timeline) qLine += ` | Timeline: ${q.timeline}`
              if (q.payment_terms) qLine += ` | Terms: ${q.payment_terms}`
              if (q.reviewer_notes) qLine += `\n      Review Notes: ${q.reviewer_notes.substring(0, 150)}`
              line += '\n' + qLine
            }
          } else {
            line += '\n    Quotes: NONE RECEIVED'
          }

          parts.push(line)
        }
      }

      // Pre-calculated summary for quick answers
      const sowIdsWithQuotes = new Set((quotes || []).map(q => q.sow_item_id))
      parts.push(`\n=== QUICK SUMMARY ===`)
      for (const [toTitle, { to, sows }] of Object.entries(byTaskOrder)) {
        const sowCount = sows.length
        const sowsWithQ = sows.filter(s => sowIdsWithQuotes.has(s.id)).length
        const qCount = (quotes || []).filter(q => sows.some(s => s.id === q.sow_item_id)).length
        const totalEstimated = sows.reduce((sum, s) => {
          const est = s.notes?.match(/Estimated value: \$([\d,]+)/)?.[1]
          return sum + (est ? parseInt(est.replace(/,/g, '')) : 0)
        }, 0)
        const totalAwarded = sows.reduce((sum, s) => sum + (parseFloat(s.awarded_amount) || 0), 0)
        const totalQuotedMin = (quotes || []).filter(q => sows.some(s => s.id === q.sow_item_id) && q.total_amount).reduce((min, q) => Math.min(min, parseFloat(q.total_amount)), Infinity)
        const totalQuotedMax = (quotes || []).filter(q => sows.some(s => s.id === q.sow_item_id) && q.total_amount).reduce((max, q) => Math.max(max, parseFloat(q.total_amount)), 0)

        let summary = `${toTitle} (${to?.status || 'unknown'}): ${sowCount} SOWs, ${qCount} quotes, ${sowsWithQ}/${sowCount} SOWs covered`
        if (totalEstimated > 0) summary += ` | Estimated: ${fmt(totalEstimated)}`
        if (to?.estimated_value) summary += ` | Contract Est: ${to.estimated_value}`
        if (totalAwarded > 0) summary += ` | Total Awarded: ${fmt(totalAwarded)}`
        if (totalQuotedMax > 0) summary += ` | Quote Range: ${fmt(totalQuotedMin)} - ${fmt(totalQuotedMax)}`
        parts.push(summary)

        // Flag SOWs missing quotes
        const missing = sows.filter(s => !sowIdsWithQuotes.has(s.id))
        if (missing.length > 0) {
          parts.push(`  Missing quotes: ${missing.map(s => s.sow_name).join(', ')}`)
        }
      }
    }

    // ========== SUBCONTRACTOR DATABASE ==========
    if (subcontractors && subcontractors.length > 0) {
      parts.push(`\n=== SUBCONTRACTOR DATABASE (${subcontractors.length}) ===`)
      const byCat: Record<string, number> = {}
      const byStatus: Record<string, number> = {}
      for (const sub of subcontractors) {
        const cats = sub.service_categories as string[] || []
        for (const c of cats) byCat[c] = (byCat[c] || 0) + 1
        byStatus[sub.incumbent_status || 'unknown'] = (byStatus[sub.incumbent_status || 'unknown'] || 0) + 1
      }
      parts.push(`By category: ${Object.entries(byCat).map(([k, v]) => `${k} (${v})`).join(', ')}`)
      parts.push(`By incumbent status: ${Object.entries(byStatus).map(([k, v]) => `${k} (${v})`).join(', ')}`)

      for (const sub of subcontractors) {
        const cats = (sub.service_categories as string[] || []).join(', ')
        const states = sub.states_covered as string[] || []
        const regions = sub.regions as string[] || []
        const certs = sub.certifications as string[] || []
        const coverage = sub.nationwide ? 'Nationwide' : (regions.length > 0 ? `Regions: ${regions.join(', ')}` : `${states.length} states`)
        let line = `  ${sub.company_name} | Contact: ${sub.contact_name || 'N/A'} | Email: ${sub.contact_email || 'N/A'} | Phone: ${sub.contact_phone || 'N/A'} | Categories: ${cats || 'N/A'} | Coverage: ${coverage} | Incumbent: ${sub.incumbent_status || 'unknown'} | Availability: ${sub.availability || 'N/A'} | Added: ${fmtDate(sub.created_at)}`
        if (certs.length > 0) line += ` | Certifications: ${certs.join(', ')}`
        if (sub.small_business) line += ' | Small Business: Yes'
        if (sub.duns_number) line += ` | DUNS: ${sub.duns_number}`
        if (sub.cage_code) line += ` | CAGE: ${sub.cage_code}`
        if (sub.website) line += ` | Web: ${sub.website}`
        if (sub.performance_notes) line += `\n    Performance: ${sub.performance_notes.substring(0, 200)}`
        parts.push(line)
      }
    } else {
      parts.push('\n=== SUBCONTRACTOR DATABASE (0) ===')
      parts.push('No subcontractors in database.')
    }

    // ========== RFQ OUTREACH STATUS ==========
    if (sowSubs && sowSubs.length > 0) {
      const statusCounts: Record<string, number> = {}
      for (const ss of sowSubs) statusCounts[ss.outreach_status] = (statusCounts[ss.outreach_status] || 0) + 1
      parts.push(`\n=== RFQ OUTREACH STATUS (${sowSubs.length} assignments) ===`)
      parts.push(`Status breakdown: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`)

      // Email engagement stats
      const emailsSent = sowSubs.filter(ss => ss.email_sent_at).length
      const emailsOpened = sowSubs.filter(ss => ss.email_opened_at).length
      const portalViewed = sowSubs.filter(ss => ss.portal_viewed_at).length
      if (emailsSent > 0) {
        parts.push(`Email engagement: ${emailsSent} sent, ${emailsOpened} opened (${Math.round(emailsOpened/emailsSent*100)}% open rate), ${portalViewed} viewed portal`)
      }
    }

    // ========== SUBCONTRACTOR QUESTIONS ==========
    if (subQuestions && subQuestions.length > 0) {
      const pending = subQuestions.filter(q => q.status === 'pending')
      const answered = subQuestions.filter(q => q.status === 'answered' || q.status === 'shared')
      parts.push(`\n=== SUBCONTRACTOR QUESTIONS (${subQuestions.length}) ===`)
      parts.push(`Pending: ${pending.length} | Answered: ${answered.length}`)
      for (const q of subQuestions.slice(0, 20)) {
        const subName = subLookup[q.subcontractor_id] || 'Unknown'
        const toTitle = taskOrders?.find(t => t.id === q.task_order_id)?.title || 'Unknown'
        let line = `  Q from ${subName} (${toTitle}): "${q.question_text.substring(0, 150)}" [${q.status}]`
        if (q.answer_text) line += `\n    A: "${q.answer_text.substring(0, 150)}"`
        parts.push(line)
      }
    }

    // ========== COMMUNICATIONS (summary + recent) ==========
    if (comms && comms.length > 0) {
      const byType: Record<string, number> = {}
      for (const c of comms) byType[c.comm_type] = (byType[c.comm_type] || 0) + 1
      parts.push(`\n=== COMMUNICATIONS (${comms.length}) ===`)
      parts.push(`By type: ${Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(', ')}`)
      // Show most recent 10
      parts.push('Recent activity:')
      for (const c of comms.slice(0, 10)) {
        const ssId = c.sow_subcontractor_id
        const ss = (sowSubs || []).find(s => s.id === ssId)
        const subName = ss ? (subLookup[ss.subcontractor_id] || 'Unknown') : 'Unknown'
        parts.push(`  ${new Date(c.created_at).toLocaleDateString()} | ${c.comm_type} (${c.direction}) | ${subName}: ${(c.subject || '').substring(0, 100)}`)
      }
    }

    // ========== DOCUMENTS ==========
    if (docs && docs.length > 0) {
      parts.push(`\n=== DOCUMENTS (${docs.length}) ===`)
      const docsByTo: Record<string, typeof docs> = {}
      for (const d of docs) {
        const toTitle = taskOrders?.find(t => t.id === d.task_order_id)?.title || d.task_order_id
        if (!docsByTo[toTitle]) docsByTo[toTitle] = []
        docsByTo[toTitle].push(d)
      }
      for (const [toTitle, toDocs] of Object.entries(docsByTo)) {
        const byCat: Record<string, number> = {}
        for (const d of toDocs) byCat[d.category || 'other'] = (byCat[d.category || 'other'] || 0) + 1
        parts.push(`  ${toTitle}: ${toDocs.length} docs (${Object.entries(byCat).map(([k, v]) => `${k}: ${v}`).join(', ')})`)
        for (const d of toDocs) {
          parts.push(`    ${d.file_name} [${d.category}] ${d.file_type || ''} (${Math.round((d.file_size || 0) / 1024)}KB)`)
        }
      }
    }

    // ========== COMPANY PROFILE ==========
    if (companyProfile && companyProfile.length > 0) {
      const cp = companyProfile[0]
      parts.push(`\n=== COMPANY PROFILE ===`)
      parts.push(`Company: ${cp.company_name} | CAGE: ${cp.cage_code || 'N/A'} | DUNS: ${cp.duns_number || 'N/A'}`)
      if (cp.naics_codes?.length) parts.push(`NAICS: ${cp.naics_codes.join(', ')}`)
      if (cp.contract_vehicles?.length) parts.push(`Contract Vehicles: ${cp.contract_vehicles.join(', ')}`)
      if (cp.primary_contact_name) parts.push(`Primary Contact: ${cp.primary_contact_name} (${cp.primary_contact_email || ''}) ${cp.primary_contact_phone || ''}`)
    }

    // ========== COMPETITORS ==========
    if (competitors && competitors.length > 0) {
      parts.push(`\n=== COMPETITOR INTELLIGENCE (${competitors.length}) ===`)
      for (const c of competitors) {
        let line = `  ${c.company_name} | Beat us: ${c.wins_against_us}x | We beat them: ${c.losses_against_us}x`
        if (c.avg_price_difference) line += ` | Avg price diff: ${fmt(c.avg_price_difference)}`
        if (c.known_services?.length) line += ` | Services: ${c.known_services.join(', ')}`
        if (c.known_regions?.length) line += ` | Regions: ${c.known_regions.join(', ')}`
        if (c.notes) line += `\n    Notes: ${c.notes.substring(0, 200)}`
        parts.push(line)
      }
    }

    // ========== INTELLIGENCE (from debriefs) ==========
    const [intelligence, debriefs] = await Promise.all([loadIntelligence(), loadAllDebriefs()])
    if (intelligence && debriefs.length > 0) {
      parts.push(`\n=== INTELLIGENCE SUMMARY (from ${debriefs.length} debriefs) ===`)
      parts.push(`Win Rate: ${intelligence.win_rate}% | Wins: ${intelligence.wins} | Losses: ${intelligence.losses} | No-Bids: ${intelligence.no_bids}`)
      if (intelligence.top_loss_reasons.length > 0) parts.push(`Top Loss Reasons: ${intelligence.top_loss_reasons.map(r => `${r.reason} (${r.count}x)`).join(', ')}`)
      if (intelligence.top_strengths.length > 0) parts.push(`Top Strengths: ${intelligence.top_strengths.map(s => `${s.strength} (${s.count}x)`).join(', ')}`)
      if (intelligence.pricing_insights.length > 0) parts.push(`Pricing Insights: ${intelligence.pricing_insights.join('; ')}`)
      if (intelligence.competitors.length > 0) parts.push(`Known Competitors: ${intelligence.competitors.map(c => `${c.name} (beat us ${c.wins_against_us}x, we beat them ${c.losses_against_us}x)`).join(', ')}`)
      parts.push(`Data Maturity: ${intelligence.data_maturity} — ${intelligence.data_maturity_description}`)

      parts.push(`\n=== DEBRIEFS ===`)
      for (const d of debriefs.slice(0, 10)) {
        let line = `${d.task_order_title}: ${d.outcome} | Our Price: ${fmt(d.our_proposed_price)}`
        if (d.final_award_price) line += ` | Award Price: ${fmt(d.final_award_price)}`
        if (d.government_estimate) line += ` | Govt Est: ${fmt(d.government_estimate)}`
        if (d.winning_competitor) line += ` | Winner: ${d.winning_competitor}`
        if (d.winning_competitor_price) line += ` at ${fmt(d.winning_competitor_price)}`
        if (d.lessons_learned) line += `\n    Lessons: ${d.lessons_learned.substring(0, 200)}`
        if (d.sub_performance_notes) line += `\n    Sub Performance: ${d.sub_performance_notes.substring(0, 200)}`
        parts.push(line)
      }
    }

    // ========== RFQ PORTAL ACTIVITY ==========
    if (rfqTokens && rfqTokens.length > 0) {
      const activeTokens = rfqTokens.filter(t => t.is_active)
      const expiredTokens = rfqTokens.filter(t => !t.is_active || new Date(t.expires_at) < new Date())
      parts.push(`\n=== RFQ PORTAL ACCESS ===`)
      parts.push(`Total portal links: ${rfqTokens.length} | Active: ${activeTokens.length} | Expired: ${expiredTokens.length}`)
    }

    // ========== EMAIL TRACKING SUMMARY ==========
    if (emailTracking && emailTracking.length > 0) {
      const byEvent: Record<string, number> = {}
      for (const e of emailTracking) byEvent[e.event_type] = (byEvent[e.event_type] || 0) + 1
      parts.push(`\n=== EMAIL TRACKING ===`)
      parts.push(`Events: ${Object.entries(byEvent).map(([k, v]) => `${k}: ${v}`).join(', ')}`)
    }

    // ========== RECENT ACTIVITY (pre-calculated for temporal questions) ==========
    parts.push(`\n=== RECENT ACTIVITY (as of ${todayStr}) ===`)
    parts.push(`NOTE: "Today" means ${todayStr}. All timestamps are compared using date components (year, month, day) after parsing into Date objects, so timezone variations in the database are handled correctly.`)

    // Subcontractors added today/this week + most recent
    const subsToday = (subcontractors || []).filter(s => isToday(s.created_at))
    const subsThisWeek = (subcontractors || []).filter(s => isThisWeek(s.created_at))
    parts.push(`New subcontractors added to MASTER DATABASE TODAY: ${subsToday.length}${subsToday.length > 0 ? ` — ${subsToday.map(s => s.company_name).join(', ')}` : ''}`)
    parts.push(`New subcontractors added to MASTER DATABASE THIS WEEK: ${subsThisWeek.length}${subsThisWeek.length > 0 ? ` — ${subsThisWeek.map(s => s.company_name).join(', ')}` : ''}`)
    parts.push(`Total subcontractors in master database: ${(subcontractors || []).length}`)
    // Find most recent subcontractor addition
    const sortedSubs = [...(subcontractors || [])].filter(s => s.created_at).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sortedSubs.length > 0) {
      const mostRecent = sortedSubs.slice(0, 5)
      parts.push(`Most recently added subcontractors: ${mostRecent.map(s => `${s.company_name} (${fmtDate(s.created_at)})`).join(', ')}`)
    }

    // SOW assignments today/this week (subcontractors aligned to specific SOWs)
    const assignmentsToday = (sowSubs || []).filter(s => isToday(s.created_at))
    const assignmentsThisWeek = (sowSubs || []).filter(s => isThisWeek(s.created_at))
    parts.push(`SOW subcontractor assignments made TODAY: ${assignmentsToday.length}${assignmentsToday.length > 0 ? ` (subcontractors were aligned/assigned to project SOWs)` : ''}`)
    parts.push(`SOW subcontractor assignments made THIS WEEK: ${assignmentsThisWeek.length}`)
    parts.push(`Total SOW assignments: ${(sowSubs || []).length}`)

    // Task orders created today/this week
    const tosToday = (taskOrders || []).filter(t => isToday(t.created_at))
    const tosThisWeek = (taskOrders || []).filter(t => isThisWeek(t.created_at))
    parts.push(`Task orders created TODAY: ${tosToday.length}${tosToday.length > 0 ? ` — ${tosToday.map(t => t.title).join(', ')}` : ''}`)
    parts.push(`Task orders created THIS WEEK: ${tosThisWeek.length}${tosThisWeek.length > 0 ? ` — ${tosThisWeek.map(t => t.title).join(', ')}` : ''}`)

    // Quotes received today/this week
    const quotesToday = (quotes || []).filter(q => isToday(q.created_at))
    const quotesThisWeek = (quotes || []).filter(q => isThisWeek(q.created_at))
    parts.push(`Quotes received TODAY: ${quotesToday.length}`)
    parts.push(`Quotes received THIS WEEK: ${quotesThisWeek.length}`)
    parts.push(`Total quotes: ${(quotes || []).length}`)

    // Documents uploaded today/this week
    const docsToday = (docs || []).filter(d => isToday(d.uploaded_at))
    const docsThisWeek = (docs || []).filter(d => isThisWeek(d.uploaded_at))
    parts.push(`Documents uploaded TODAY: ${docsToday.length}`)
    parts.push(`Documents uploaded THIS WEEK: ${docsThisWeek.length}`)

    // Communications today/this week
    const commsToday = (comms || []).filter(c => isToday(c.created_at))
    const commsThisWeek = (comms || []).filter(c => isThisWeek(c.created_at))
    parts.push(`Communications TODAY: ${commsToday.length}`)
    parts.push(`Communications THIS WEEK: ${commsThisWeek.length}`)

    // RFQ outreach today/this week
    const rfqsSentToday = (sowSubs || []).filter(s => isToday(s.email_sent_at))
    const rfqsSentThisWeek = (sowSubs || []).filter(s => isThisWeek(s.email_sent_at))
    parts.push(`RFQ emails sent TODAY: ${rfqsSentToday.length}`)
    parts.push(`RFQ emails sent THIS WEEK: ${rfqsSentThisWeek.length}`)

    return parts.join('\n')
  }

  async function sendMessage(userMessage: string) {
    if (!userMessage.trim() || loading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      // Re-fetch ALL data fresh from the database for EVERY question
      console.log('[Procuvex Intelligence] Building fresh context for question:', userMessage.substring(0, 100))
      const contextStart = performance.now()
      const freshContext = await buildContext()
      const contextMs = Math.round(performance.now() - contextStart)
      console.log(`[Procuvex Intelligence] Context built in ${contextMs}ms, size: ${freshContext.length} chars`)

      const systemPrompt = `You are Procuvex Intelligence, the AI assistant for the Procuvex procurement intelligence platform by Core314 Technologies LLC.

You have access to a LIVE DATABASE SNAPSHOT taken at the exact moment the user asked this question. The data below is comprehensive and current — it includes every project, SOW, subcontractor, quote, RFQ, communication, document, and metric in the system.

CRITICAL RULES — FOLLOW EXACTLY:
1. ONLY answer from the ACCOUNT DATA below. This is your single source of truth. Every number, name, date, and status you cite MUST come from this data.
2. NEVER fabricate, estimate, or assume information not present in the data. If the data does not contain what is asked, say: "That specific data is not currently tracked in the system. Here is what IS available: [list relevant data]."
3. ALWAYS provide specific numbers. Never say "various" or "several" — count them. Never say "some amount" — state the dollar figure. Never say "recently" — state the date.
4. For FINANCIAL questions: Use estimated_value, awarded_amount, total_amount fields. Calculate sums, averages, and ranges. Distinguish between estimates (subject to change) and awarded amounts (finalized). State which projects are "awarded" vs "evaluating" when relevant.
5. For TIME-BASED questions ("today", "this week", "when"): The RECENT ACTIVITY section has pre-calculated counts for today and this week with names listed. Use these counts DIRECTLY — they are pre-calculated from the database at query time and are authoritative. Do NOT try to recount from the individual records. Every record also has its Added/Created date for manual verification.
6. For STATUS questions: Use exact status values from the data and explain their meaning.
7. For SUBCONTRACTOR questions: Include company name, contact info, service categories, coverage area, and any assignment/outreach status. IMPORTANT: The platform tracks subcontractors in TWO ways: (a) the Master Subcontractor Database (new companies added), and (b) SOW Assignments (existing subcontractors assigned/aligned to specific project SOWs). When the user asks about "adding" subcontractors, report BOTH: new companies added to the master database AND new SOW assignments made. These are distinct actions.
8. For RFQ/OUTREACH questions: Include outreach_status, email engagement (sent/opened/clicked), portal views, and question counts.
9. Format: Be concise but thorough. Use bullet points. Format dollars as currency ($X,XXX). Format dates clearly. Bold key figures. Always provide context — don't just say a number, explain what it means.
10. When the factual answer is "zero" or "none", state that confidently. Then ALWAYS provide helpful context: what the total count is, when the most recent activity was, and any related activity. For example, if zero subcontractors were added today, also mention the total count, when the last ones were added, and any SOW assignments made today.
11. If data seems incomplete or inconsistent, note what you see and suggest what might be missing — but never invent the missing data.
12. PROACTIVE CONTEXT: After answering the direct question, briefly mention 1-2 related data points the user might find useful. For example, after answering about subcontractors, mention how many are assigned to SOWs or have been contacted via RFQ.
${SMART_NOTES_PROMPT}

ACCOUNT DATA (live snapshot):
${freshContext}`

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.05,
          max_tokens: 2048,
        }),
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

      // Check if response contains proposed changes
      const proposedChanges = parseSmartNotesResponse(reply)
      const humanContent = proposedChanges ? getHumanResponse(reply) : reply

      setMessages([...newMessages, {
        role: 'assistant',
        content: humanContent || 'I\'ve analyzed your notes and have the following proposed updates:',
        proposedChanges: proposedChanges || undefined,
      }])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${errorMessage}. Please try again.` }])
    } finally {
      setLoading(false)
    }
  }

  async function handleApplyChanges(msgIndex: number) {
    const msg = messages[msgIndex]
    if (!msg.proposedChanges || msg.changesApplied) return

    setLoading(true)
    try {
      const result = await applyChanges(msg.proposedChanges.changes)
      const updated = [...messages]
      updated[msgIndex] = { ...msg, changesApplied: true, changesResult: result }
      setMessages(updated)

      // Context will be refreshed on next question automatically
    } finally {
      setLoading(false)
    }
  }

  function handleRejectChanges(msgIndex: number) {
    const msg = messages[msgIndex]
    const updated = [...messages]
    updated[msgIndex] = { ...msg, changesApplied: true, changesResult: { success: 0, errors: ['Changes rejected by user'] } }
    setMessages(updated)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full p-4 shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-105 z-50 flex items-center gap-2"
        title="Ask Procuvex Intelligence"
      >
        <Sparkles size={24} />
        <span className="text-sm font-medium hidden md:inline">Ask Procuvex Intelligence</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-[420px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <div>
            <h3 className="font-semibold text-sm">Procuvex Intelligence</h3>
            <p className="text-xs text-blue-100">Account-wide assistant</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[420px]">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="bg-indigo-100 rounded-full p-1.5 flex-shrink-0">
                <Bot size={14} className="text-indigo-600" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                Hi! I'm <strong>Procuvex Intelligence</strong>. I can answer questions about your entire account, or <strong>share notes and intel</strong> — I'll extract the key information and update the system.
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium px-1">Suggested questions:</p>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-xs bg-indigo-50 text-indigo-700 rounded-lg px-3 py-2 hover:bg-indigo-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 mt-2">
              <p className="text-xs text-gray-400 font-medium px-1 flex items-center gap-1"><FileText size={12} /> Share notes or intel:</p>
              {SMART_NOTES_SUGGESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="w-full text-left text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="space-y-2">
            <div className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`rounded-full p-1.5 flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-200' : 'bg-indigo-100'}`}>
                {msg.role === 'user' ? <User size={14} className="text-gray-600" /> : <Bot size={14} className="text-indigo-600" />}
              </div>
              <div className={`rounded-lg p-3 text-sm max-w-[320px] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>

            {/* Proposed Changes Card */}
            {msg.proposedChanges && (
              <div className="ml-8 border border-amber-200 bg-amber-50 rounded-lg p-3 max-w-[340px]">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={14} className="text-amber-600" />
                  <span className="text-xs font-semibold text-amber-800">Proposed Updates ({msg.proposedChanges.changes.length})</span>
                </div>
                <div className="space-y-1.5 mb-3">
                  {msg.proposedChanges.changes.map((change, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs text-amber-900">
                      <span className="mt-0.5">
                        {change.action === 'add_subcontractor' ? '+' : change.action === 'update_subcontractor' ? '~' : change.action === 'add_note' ? '#' : '*'}
                      </span>
                      <span>{change.description}</span>
                    </div>
                  ))}
                </div>

                {!msg.changesApplied ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApplyChanges(i)}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 size={12} /> Apply Changes
                    </button>
                    <button
                      onClick={() => handleRejectChanges(i)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                ) : (
                  <div className="text-xs">
                    {msg.changesResult && msg.changesResult.success > 0 && (
                      <div className="flex items-center gap-1 text-green-700">
                        <CheckCircle2 size={12} /> {msg.changesResult.success} change(s) applied successfully
                      </div>
                    )}
                    {msg.changesResult && msg.changesResult.errors.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {msg.changesResult.errors.map((err, k) => (
                          <div key={k} className="flex items-start gap-1 text-red-600">
                            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {err}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.changesResult && msg.changesResult.success === 0 && msg.changesResult.errors.length === 1 && msg.changesResult.errors[0] === 'Changes rejected by user' && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <XCircle size={12} /> Changes rejected
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="bg-indigo-100 rounded-full p-1.5 flex-shrink-0">
              <Bot size={14} className="text-indigo-600" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <Loader2 size={16} className="animate-spin text-indigo-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 flex gap-2 flex-shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
          placeholder="Ask a question or paste your notes..."
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          rows={input.length > 100 ? 3 : 1}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-indigo-600 text-white rounded-lg px-3 py-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
