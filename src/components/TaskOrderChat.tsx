import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, CheckCircle2, XCircle, FileText, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { parseSmartNotesResponse, getHumanResponse, applyChanges, SMART_NOTES_PROMPT, type SmartNotesResult } from '../lib/smartNotes'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  proposedChanges?: SmartNotesResult
  changesApplied?: boolean
  changesResult?: { success: number; errors: string[] }
}

interface TaskOrderChatProps {
  taskOrderId: string
  taskOrderTitle: string
  analysisResult: Record<string, unknown> | null
}

const SUGGESTED_QUESTIONS = [
  'How many subcontractors have responded with quotes?',
  'Which SOWs are missing quotes?',
  'What is the total estimated cost so far?',
  'Summarize the key risks for this task order.',
  'Which subcontractors haven\'t responded yet?',
  'What is the PoP structure?',
]

const SMART_NOTES_SUGGESTIONS = [
  'I visited the site and here are my notes...',
  'The incumbent for HVAC at this location is...',
  'I met with the facility manager and learned...',
]

export default function TaskOrderChat({ taskOrderId, taskOrderTitle, analysisResult }: TaskOrderChatProps) {
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

    parts.push(`Task Order: ${taskOrderTitle}`)
    parts.push(`Task Order ID: ${taskOrderId}`)

    // Add analysis result summary
    if (analysisResult) {
      const meta = analysisResult.task_order_metadata as Record<string, unknown> | undefined
      if (meta) {
        parts.push('\n--- TASK ORDER METADATA ---')
        if (meta.pop_structure_summary) parts.push(`PoP Structure: ${meta.pop_structure_summary}`)
        if (meta.pop_base_period) parts.push(`Base Period: ${meta.pop_base_period}`)
        if (meta.pop_option_periods && Array.isArray(meta.pop_option_periods)) {
          parts.push(`Option Periods: ${(meta.pop_option_periods as string[]).join('; ')}`)
        }
        if (meta.contract_number) parts.push(`Contract: ${meta.contract_number}`)
        if (meta.naics_code) parts.push(`NAICS: ${meta.naics_code}`)
      }
      const summary = analysisResult.summary as string | undefined
      if (summary) parts.push(`\nAnalysis Summary: ${summary}`)

      const cats = analysisResult.service_categories as Array<{ category: string; description: string }> | undefined
      if (cats && cats.length > 0) {
        parts.push(`\nService Categories (${cats.length}): ${cats.map(c => c.category).join(', ')}`)
      }
    }

    // Fetch SOW items
    const { data: sowItems } = await supabase
      .from('sow_items')
      .select('*')
      .eq('task_order_id', taskOrderId)

    if (sowItems && sowItems.length > 0) {
      parts.push(`\n--- SOW ITEMS (${sowItems.length}) ---`)
      for (const sow of sowItems) {
        parts.push(`SOW: ${sow.sow_name} | Category: ${sow.service_category} | Status: ${sow.status}${sow.awarded_amount ? ` | Awarded: $${sow.awarded_amount}` : ''}`)
      }

      // Build a subcontractor lookup map
      const { data: allSubs } = await supabase.from('subcontractors').select('id, company_name')
      const subLookup: Record<string, string> = {}
      if (allSubs) {
        for (const s of allSubs) subLookup[s.id] = s.company_name
      }

      // Fetch subcontractor assignments for each SOW (without FK join to avoid silent failures)
      const sowIds = sowItems.map(s => s.id)
      const { data: sowSubs } = await supabase
        .from('sow_subcontractors')
        .select('*')
        .in('sow_item_id', sowIds)

      if (sowSubs && sowSubs.length > 0) {
        parts.push(`\n--- SUBCONTRACTOR ASSIGNMENTS (${sowSubs.length}) ---`)
        const bySow: Record<string, typeof sowSubs> = {}
        for (const ss of sowSubs) {
          const sowName = sowItems.find(s => s.id === ss.sow_item_id)?.sow_name || ss.sow_item_id
          if (!bySow[sowName]) bySow[sowName] = []
          bySow[sowName].push(ss)
        }
        for (const [sowName, subs] of Object.entries(bySow)) {
          parts.push(`\n${sowName}:`)
          for (const sub of subs) {
            const companyName = subLookup[sub.subcontractor_id] || 'Unknown'
            parts.push(`  - ${companyName} | Status: ${sub.outreach_status}${sub.rfq_sent_date ? ` | RFQ Sent: ${new Date(sub.rfq_sent_date).toLocaleDateString()}` : ''}${sub.response_date ? ` | Responded: ${new Date(sub.response_date).toLocaleDateString()}` : ''}`)
          }
        }

        // Fetch communications
        const sowSubIds = sowSubs.map(s => s.id)
        const { data: comms } = await supabase
          .from('sow_communications')
          .select('*')
          .in('sow_subcontractor_id', sowSubIds)
          .order('created_at', { ascending: false })
          .limit(20)

        if (comms && comms.length > 0) {
          parts.push(`\n--- RECENT COMMUNICATIONS (${comms.length}) ---`)
          for (const c of comms) {
            parts.push(`${new Date(c.created_at).toLocaleDateString()} | ${c.comm_type} (${c.direction}) | ${c.subject || 'No subject'}`)
          }
        }
      }

      // Fetch ALL quotes for this task order's SOWs (independent of sow_subcontractors)
      const { data: quotes } = await supabase
        .from('sow_quotes')
        .select('*')
        .in('sow_item_id', sowIds)

      if (quotes && quotes.length > 0) {
        parts.push(`\n--- QUOTES RECEIVED (${quotes.length}) ---`)
        for (const q of quotes) {
          const subName = subLookup[q.subcontractor_id] || 'Unknown'
          const sowName = sowItems.find(s => s.id === q.sow_item_id)?.sow_name || q.sow_item_id
          parts.push(`${subName} → ${sowName}: $${q.total_amount || 'N/A'}${q.monthly_amount ? ` (monthly: $${q.monthly_amount})` : ''} | Status: ${q.status}`)
        }
      } else {
        parts.push('\n--- QUOTES RECEIVED (0) ---')
        parts.push('No quotes have been submitted yet.')
      }

      // Per-SOW quote coverage summary
      const sowIdsWithQuotes = new Set((quotes || []).map(q => q.sow_item_id))
      const sowsWithQ = sowItems.filter(s => sowIdsWithQuotes.has(s.id)).length
      parts.push(`\n--- QUOTE COVERAGE SUMMARY ---`)
      parts.push(`Total SOWs: ${sowItems.length} | Total Quotes: ${(quotes || []).length} | SOWs with at least one quote: ${sowsWithQ}/${sowItems.length}`)
      for (const sow of sowItems) {
        const sqCount = (quotes || []).filter(q => q.sow_item_id === sow.id).length
        parts.push(`  - ${sow.sow_name}: ${sqCount} quote(s)${sqCount === 0 ? ' ⚠ MISSING' : ''}`)
      }
      if (sowsWithQ === sowItems.length) {
        parts.push(`STATUS: All SOWs have at least one quote.`)
      } else {
        parts.push(`STATUS: ${sowItems.length - sowsWithQ} SOW(s) are still missing quotes.`)
      }
    } else {
      parts.push('\n--- SOW ITEMS ---')
      parts.push('No SOW items have been created yet. Run "Sync from AI Analysis" in the SOW Bid Management section.')
    }

    // Fetch documents list
    const { data: docs } = await supabase
      .from('documents')
      .select('file_name, category, file_size')
      .eq('task_order_id', taskOrderId)

    if (docs && docs.length > 0) {
      parts.push(`\n--- UPLOADED DOCUMENTS (${docs.length}) ---`)
      for (const d of docs) {
        parts.push(`${d.file_name} (${d.category}) - ${Math.round(d.file_size / 1024)}KB`)
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
      const systemPrompt = `You are Procuvex Intelligence, the AI assistant for the Procuvex procurement intelligence platform by Core314 Technologies LLC. You have access to real-time data about this specific task order.

RULES:
- Answer based on the TASK ORDER DATA below. Reference specific SOW names, subcontractor names, and dollar amounts from the data.
- Never fabricate or invent information. If the data doesn't contain what's being asked about, say so.
- When answering about quotes, coverage, or gaps, use the QUOTE COVERAGE SUMMARY — it has pre-calculated accurate counts.
- Be concise and direct. Use bullet points for lists. Format money as currency.
- When the data clearly answers a question (even if the answer is "none" or "zero"), give that answer directly and confidently.
${SMART_NOTES_PROMPT}

TASK ORDER DATA:
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
      const result = await applyChanges(msg.proposedChanges.changes, taskOrderId)
      const updated = [...messages]
      updated[msgIndex] = { ...msg, changesApplied: true, changesResult: result }
      setMessages(updated)

      // Refresh context so subsequent questions reflect the updates
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
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-all hover:scale-105 z-50 flex items-center gap-2"
        title="Procuvex Intelligence"
      >
        <MessageCircle size={24} />
        <span className="text-sm font-medium hidden md:inline">Ask Procuvex Intelligence</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-[420px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <div>
            <h3 className="font-semibold text-sm">Procuvex Intelligence</h3>
            <p className="text-xs text-blue-100 truncate max-w-[250px]">{taskOrderTitle}</p>
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
              <div className="bg-blue-100 rounded-full p-1.5 flex-shrink-0">
                <Bot size={14} className="text-blue-600" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                Hi! I can answer questions about the <strong>{taskOrderTitle}</strong> task order, or <strong>share your site visit notes</strong> and I'll extract the key information and update the system.
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium px-1">Suggested questions:</p>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-xs bg-blue-50 text-blue-700 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors"
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
              <div className={`rounded-full p-1.5 flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-200' : 'bg-blue-100'}`}>
                {msg.role === 'user' ? <User size={14} className="text-gray-600" /> : <Bot size={14} className="text-blue-600" />}
              </div>
              <div className={`rounded-lg p-3 text-sm max-w-[320px] ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
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
            <div className="bg-blue-100 rounded-full p-1.5 flex-shrink-0">
              <Bot size={14} className="text-blue-600" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <Loader2 size={16} className="animate-spin text-blue-500" />
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
          placeholder="Ask a question or paste your site visit notes..."
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={input.length > 100 ? 3 : 1}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
