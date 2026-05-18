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
  'How many active task orders do we have?',
  'Which task orders are missing subcontractor quotes?',
  'How many subcontractors are in our database?',
  'What is the total estimated value across all task orders?',
  'Which SOWs across all task orders have no quotes?',
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
  const [, setContextLoaded] = useState(false)
  const [context, setContext] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      buildContext()
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function buildContext() {
    const parts: string[] = []

    // Fetch all task orders
    const { data: taskOrders } = await supabase
      .from('task_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (taskOrders && taskOrders.length > 0) {
      parts.push(`--- TASK ORDERS (${taskOrders.length}) ---`)
      for (const to of taskOrders) {
        parts.push(`Task Order: ${to.title} | Site: ${to.site_name || 'N/A'} | Location: ${to.location_city ? `${to.location_city}, ${to.location_state}` : 'N/A'} | Status: ${to.status} | Due: ${to.response_deadline || 'N/A'}`)
      }
    } else {
      parts.push('--- TASK ORDERS (0) ---')
      parts.push('No task orders have been registered yet.')
    }

    // Fetch all subcontractors
    const { data: subcontractors } = await supabase
      .from('subcontractors')
      .select('*')

    if (subcontractors && subcontractors.length > 0) {
      parts.push(`\n--- SUBCONTRACTOR DATABASE (${subcontractors.length}) ---`)
      const byCat: Record<string, number> = {}
      const byStatus: Record<string, number> = {}
      for (const sub of subcontractors) {
        const cats = sub.service_categories as string[] || []
        for (const c of cats) {
          byCat[c] = (byCat[c] || 0) + 1
        }
        const incumbentStatus = (sub.incumbent_status as string) || 'unknown'
        byStatus[incumbentStatus] = (byStatus[incumbentStatus] || 0) + 1
      }
      parts.push(`Subcontractors by service category: ${Object.entries(byCat).map(([k, v]) => `${k} (${v})`).join(', ')}`)
      parts.push(`Subcontractors by incumbent status: ${Object.entries(byStatus).map(([k, v]) => `${k} (${v})`).join(', ')}`)
      for (const sub of subcontractors) {
        const cats = (sub.service_categories as string[] || []).join(', ')
        const states = (sub.states_covered as string[] || [])
        const coverage = sub.nationwide ? 'Nationwide' : `${states.length} states`
        parts.push(`  - ${sub.company_name} | Contact: ${sub.contact_name || 'N/A'} | Email: ${sub.contact_email || 'N/A'} | Categories: ${cats || 'N/A'} | Coverage: ${coverage} | Incumbent: ${sub.incumbent_status || 'unknown'} | Availability: ${sub.availability || 'N/A'}`)
      }
    } else {
      parts.push('\n--- SUBCONTRACTOR DATABASE (0) ---')
      parts.push('No subcontractors have been added to the database yet.')
    }

    // Fetch all SOW items across all task orders
    const { data: sowItems } = await supabase
      .from('sow_items')
      .select('*')
      .order('task_order_id')

    if (sowItems && sowItems.length > 0) {
      parts.push(`\n--- SOW ITEMS ACROSS ALL TASK ORDERS (${sowItems.length}) ---`)
      const byTaskOrder: Record<string, typeof sowItems> = {}
      for (const sow of sowItems) {
        const toTitle = taskOrders?.find(t => t.id === sow.task_order_id)?.title || sow.task_order_id
        if (!byTaskOrder[toTitle]) byTaskOrder[toTitle] = []
        byTaskOrder[toTitle].push(sow)
      }
      for (const [toTitle, sows] of Object.entries(byTaskOrder)) {
        parts.push(`\n${toTitle}:`)
        for (const sow of sows) {
          parts.push(`  - ${sow.sow_name} | Category: ${sow.service_category} | Status: ${sow.status}${sow.awarded_amount ? ` | Awarded: $${sow.awarded_amount}` : ''}`)
        }
      }

      // Fetch all quotes (query without FK join to avoid silent failures)
      const { data: quotes } = await supabase
        .from('sow_quotes')
        .select('*')

      // Build a subcontractor lookup map
      const subLookup: Record<string, string> = {}
      if (subcontractors) {
        for (const s of subcontractors) {
          subLookup[s.id] = s.company_name
        }
      }

      if (quotes && quotes.length > 0) {
        parts.push(`\n--- ALL QUOTES (${quotes.length}) ---`)
        for (const q of quotes) {
          const subName = subLookup[q.subcontractor_id] || 'Unknown'
          const sowName = sowItems.find(s => s.id === q.sow_item_id)?.sow_name || q.sow_item_id
          const toTitle = taskOrders?.find(t => t.id === sowItems.find(s => s.id === q.sow_item_id)?.task_order_id)?.title || 'Unknown'
          parts.push(`${subName} → ${sowName} (${toTitle}): $${q.total_amount || 'N/A'} | Status: ${q.status}`)
        }
      } else {
        parts.push('\n--- ALL QUOTES (0) ---')
        parts.push('No quotes have been submitted across any task order.')
      }

      // SOWs missing quotes
      const sowIdsWithQuotes = new Set((quotes || []).map(q => q.sow_item_id))
      const sowsMissingQuotes = sowItems.filter(s => !sowIdsWithQuotes.has(s.id))
      if (sowsMissingQuotes.length > 0) {
        parts.push(`\n--- SOWs MISSING QUOTES (${sowsMissingQuotes.length}) ---`)
        for (const sow of sowsMissingQuotes) {
          const toTitle = taskOrders?.find(t => t.id === sow.task_order_id)?.title || 'Unknown'
          parts.push(`  - ${sow.sow_name} (${toTitle})`)
        }
      } else {
        parts.push('\n--- SOWs MISSING QUOTES (0) ---')
        parts.push('All SOWs across all task orders have at least one quote.')
      }

      // Per-task-order quote summary for accuracy
      parts.push(`\n--- QUOTE COVERAGE SUMMARY BY TASK ORDER ---`)
      for (const [toTitle, sows] of Object.entries(byTaskOrder)) {
        const sowCount = sows.length
        const sowsWithQ = sows.filter(s => sowIdsWithQuotes.has(s.id)).length
        const quoteCount = (quotes || []).filter(q => sows.some(s => s.id === q.sow_item_id)).length
        parts.push(`${toTitle}: ${sowCount} SOWs, ${quoteCount} total quotes, ${sowsWithQ}/${sowCount} SOWs have at least one quote`)
        for (const sow of sows) {
          const sqCount = (quotes || []).filter(q => q.sow_item_id === sow.id).length
          parts.push(`  - ${sow.sow_name}: ${sqCount} quote(s)${sqCount === 0 ? ' ⚠ MISSING' : ''}`)
        }
      }
    }

    // Fetch document counts per task order
    const { data: docs } = await supabase
      .from('documents')
      .select('task_order_id, file_name')

    if (docs && docs.length > 0) {
      const docsByTo: Record<string, number> = {}
      for (const d of docs) {
        const toTitle = taskOrders?.find(t => t.id === d.task_order_id)?.title || d.task_order_id
        docsByTo[toTitle] = (docsByTo[toTitle] || 0) + 1
      }
      parts.push(`\n--- DOCUMENTS ---`)
      parts.push(`Total documents: ${docs.length}`)
      for (const [toTitle, count] of Object.entries(docsByTo)) {
        parts.push(`  - ${toTitle}: ${count} documents`)
      }
    }

    // Intelligence data from debriefs
    const [intelligence, debriefs] = await Promise.all([loadIntelligence(), loadAllDebriefs()])
    if (intelligence && debriefs.length > 0) {
      parts.push(`\n--- INTELLIGENCE SUMMARY (from ${debriefs.length} debriefs) ---`)
      parts.push(`Win Rate: ${intelligence.win_rate}% | Wins: ${intelligence.wins} | Losses: ${intelligence.losses} | No-Bids: ${intelligence.no_bids}`)
      if (intelligence.top_loss_reasons.length > 0) {
        parts.push(`Top Loss Reasons: ${intelligence.top_loss_reasons.map(r => `${r.reason} (${r.count}x)`).join(', ')}`)
      }
      if (intelligence.top_strengths.length > 0) {
        parts.push(`Top Strengths: ${intelligence.top_strengths.map(s => `${s.strength} (${s.count}x)`).join(', ')}`)
      }
      if (intelligence.pricing_insights.length > 0) {
        parts.push(`Pricing Insights: ${intelligence.pricing_insights.join('; ')}`)
      }
      if (intelligence.competitors.length > 0) {
        parts.push(`Known Competitors: ${intelligence.competitors.map(c => `${c.name} (beat us ${c.wins_against_us}x, we beat them ${c.losses_against_us}x)`).join(', ')}`)
      }
      parts.push(`Data Maturity: ${intelligence.data_maturity} — ${intelligence.data_maturity_description}`)

      parts.push(`\n--- RECENT DEBRIEFS ---`)
      for (const d of debriefs.slice(0, 5)) {
        parts.push(`${d.task_order_title}: ${d.outcome} | Our Price: $${d.our_proposed_price || 'N/A'}${d.winning_competitor ? ` | Winner: ${d.winning_competitor}` : ''}${d.lessons_learned ? ` | Lesson: ${d.lessons_learned.substring(0, 200)}` : ''}`)
      }
    }

    setContext(parts.join('\n'))
    setContextLoaded(true)
  }

  async function sendMessage(userMessage: string) {
    if (!userMessage.trim() || loading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const systemPrompt = `You are Core314 Intelligence, the AI assistant for the Task Order Intelligence platform by Core314 Technologies LLC. You have access to real-time data about all task orders, subcontractors, quotes, and bid management across the user's account, plus historical intelligence from debriefs.

RULES:
- Answer based on the ACCOUNT DATA below. Reference specific names, numbers, and dollar amounts from the data.
- Never fabricate or invent information. If the data doesn't contain what's being asked about, say so.
- When answering about quotes, coverage, or gaps, use the QUOTE COVERAGE SUMMARY — it has pre-calculated accurate counts.
- When answering about wins, losses, or competitors, use the INTELLIGENCE SUMMARY section.
- Be concise and direct. Use bullet points for lists. Format money as currency.
- When the data clearly answers a question (even if the answer is "none" or "zero"), give that answer directly and confidently.
${SMART_NOTES_PROMPT}

ACCOUNT DATA:
${context}`

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
          temperature: 0.1,
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

      // Refresh context
      setContextLoaded(false)
      buildContext()
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
        title="Ask Core314 Intelligence"
      >
        <Sparkles size={24} />
        <span className="text-sm font-medium hidden md:inline">Ask Core314 Intelligence</span>
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
            <h3 className="font-semibold text-sm">Core314 Intelligence</h3>
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
                Hi! I'm <strong>Core314 Intelligence</strong>. I can answer questions about your entire account, or <strong>share notes and intel</strong> — I'll extract the key information and update the system.
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
