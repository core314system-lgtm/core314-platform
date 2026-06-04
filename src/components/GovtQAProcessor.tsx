import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FileSpreadsheet, Brain, CheckCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp, Send, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'

interface QAPair {
  question_number: string | null
  question_text: string
  answer_text: string
  section_reference: string | null
}

interface MatchResult {
  govt_qa: QAPair
  matched_sub_question: {
    id: string
    question_text: string
    subcontractor_id: string
    company_name: string
    contact_email: string | null
    sow_name: string | null
    status: string
  } | null
  confidence: number
  match_reason: string
  approved: boolean
  admin_note: string
}

interface Props {
  taskOrderId: string
  taskOrderTitle: string
}

export default function GovtQAProcessor({ taskOrderId }: Props) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [step, setStep] = useState<'upload' | 'review' | 'distribute' | 'complete'>('upload')
  const [qaPairs, setQaPairs] = useState<QAPair[]>([])
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [parsing, setParsing] = useState(false)
  const [matching, setMatching] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [manualEntry, setManualEntry] = useState(false)
  const [newQa, setNewQa] = useState<QAPair>({ question_number: '', question_text: '', answer_text: '', section_reference: '' })

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setParseError('')
    setUploadedFileName(file.name)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        // Parse Excel/CSV
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as (string | number | undefined)[][]

        if (rows.length < 2) {
          setParseError('File appears empty or has only headers.')
          setParsing(false)
          return
        }

        // Try to detect column layout
        const header = rows[0].map(h => String(h || '').toLowerCase().trim())
        let qCol = -1, aCol = -1, numCol = -1, secCol = -1

        for (let i = 0; i < header.length; i++) {
          if (header[i].includes('question') && !header[i].includes('number') && !header[i].includes('#')) qCol = i
          if (header[i].includes('answer') || header[i].includes('response')) aCol = i
          if (header[i].includes('number') || header[i].includes('#') || header[i].includes('no.') || header[i].includes('item')) numCol = i
          if (header[i].includes('section') || header[i].includes('reference') || header[i].includes('ref')) secCol = i
        }

        // If we couldn't find explicit headers, assume: col 0 = number, col 1 = question, col 2 = answer
        if (qCol === -1 && aCol === -1) {
          if (rows[0].length >= 3) {
            numCol = 0; qCol = 1; aCol = 2
          } else if (rows[0].length >= 2) {
            qCol = 0; aCol = 1
          } else {
            setParseError('Could not detect question and answer columns. Expected at least 2 columns.')
            setParsing(false)
            return
          }
        }

        if (qCol === -1) qCol = aCol > 0 ? 0 : 1
        if (aCol === -1) aCol = qCol + 1

        const parsed: QAPair[] = []
        const startRow = header.some(h => h.includes('question') || h.includes('answer')) ? 1 : 0

        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i]
          const q = String(row[qCol] || '').trim()
          const a = String(row[aCol] || '').trim()
          if (!q && !a) continue

          parsed.push({
            question_number: numCol >= 0 ? String(row[numCol] || '').trim() || null : `Q${parsed.length + 1}`,
            question_text: q,
            answer_text: a,
            section_reference: secCol >= 0 ? String(row[secCol] || '').trim() || null : null,
          })
        }

        if (parsed.length === 0) {
          setParseError('No Q&A pairs found in the file.')
          setParsing(false)
          return
        }

        setQaPairs(parsed)
        setStep('review')
      } else if (ext === 'pdf' || ext === 'doc' || ext === 'docx' || ext === 'txt') {
        // For non-spreadsheet files, we'll read as text if possible
        if (ext === 'txt') {
          const text = await file.text()
          const lines = text.split('\n').filter(l => l.trim())
          const parsed: QAPair[] = []
          let currentQ = ''
          let currentA = ''
          let num = 0

          for (const line of lines) {
            const trimmed = line.trim()
            if (/^(Q\d+|Question\s*\d+|#\d+|\d+\.?\s*Q)/i.test(trimmed)) {
              if (currentQ && currentA) {
                parsed.push({
                  question_number: `Q${num}`,
                  question_text: currentQ,
                  answer_text: currentA,
                  section_reference: null,
                })
              }
              num++
              currentQ = trimmed.replace(/^(Q\d+[.:]\s*|Question\s*\d+[.:]\s*|#\d+[.:]\s*|\d+\.?\s*Q[.:]\s*)/i, '')
              currentA = ''
            } else if (/^(A\d*|Answer|Response)/i.test(trimmed)) {
              currentA = trimmed.replace(/^(A\d*[.:]\s*|Answer[.:]\s*|Response[.:]\s*)/i, '')
            } else if (currentQ && !currentA) {
              currentQ += ' ' + trimmed
            } else if (currentA || currentQ) {
              currentA += ' ' + trimmed
            }
          }

          if (currentQ && currentA) {
            parsed.push({
              question_number: `Q${num}`,
              question_text: currentQ,
              answer_text: currentA,
              section_reference: null,
            })
          }

          if (parsed.length > 0) {
            setQaPairs(parsed)
            setStep('review')
          } else {
            setParseError('Could not parse Q&A pairs from text file. Try using the manual entry option or upload an Excel file with Question and Answer columns.')
          }
        } else {
          setParseError(`${ext?.toUpperCase()} parsing requires manual entry. Please upload an Excel (.xlsx) or CSV file, or use manual entry below.`)
        }
      } else {
        setParseError('Unsupported file type. Please upload .xlsx, .xls, .csv, or .txt files.')
      }
    } catch (err: unknown) {
      setParseError('Failed to parse file: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setParsing(false)
    }
  }, [])

  function addManualQA() {
    if (!newQa.question_text.trim() || !newQa.answer_text.trim()) return
    setQaPairs(prev => [...prev, {
      question_number: newQa.question_number?.trim() || `Q${prev.length + 1}`,
      question_text: newQa.question_text.trim(),
      answer_text: newQa.answer_text.trim(),
      section_reference: newQa.section_reference?.trim() || null,
    }])
    setNewQa({ question_number: '', question_text: '', answer_text: '', section_reference: '' })
  }

  function removeQA(index: number) {
    setQaPairs(prev => prev.filter((_, i) => i !== index))
  }

  async function handleMatchQuestions() {
    setMatching(true)
    try {
      const resp = await fetch('/api/process-govt-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_order_id: taskOrderId,
          qa_pairs: qaPairs,
          action: 'match',
        }),
      })

      const result = await resp.json()
      if (result.success) {
        const enrichedMatches: MatchResult[] = (result.matches || []).map((m: Partial<MatchResult>) => ({
          ...m,
          approved: (m.confidence ?? 0) >= 70 && m.matched_sub_question !== null,
          admin_note: '',
        }))
        setMatches(enrichedMatches)
        setStep('distribute')
      } else {
        alert('Matching failed: ' + (result.error || 'Unknown error'))
      }
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setMatching(false)
    }
  }

  async function handleDistribute() {
    setDistributing(true)
    try {
      const approvedMatches = matches.filter(m => m.approved && m.matched_sub_question)

      // Group by subcontractor
      const subGroups = new Map<string, { sub: MatchResult['matched_sub_question']; qa_pairs: { govt_qa: QAPair; admin_note: string }[] }>()
      for (const m of approvedMatches) {
        const sub = m.matched_sub_question!
        const existing = subGroups.get(sub.subcontractor_id)
        if (existing) {
          existing.qa_pairs.push({ govt_qa: m.govt_qa, admin_note: m.admin_note })
        } else {
          subGroups.set(sub.subcontractor_id, {
            sub,
            qa_pairs: [{ govt_qa: m.govt_qa, admin_note: m.admin_note }],
          })
        }
      }

      // Send targeted notifications
      const resp = await fetch('/api/notify-qa-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_order_id: taskOrderId,
          distributions: Array.from(subGroups.entries()).map(([subId, group]) => ({
            subcontractor_id: subId,
            company_name: group.sub?.company_name,
            contact_email: group.sub?.contact_email,
            qa_pairs: group.qa_pairs,
          })),
        }),
      })

      const result = await resp.json()
      if (result.success) {
        // Update question statuses
        for (const m of approvedMatches) {
          if (m.matched_sub_question) {
            await supabase
              .from('opportunity_questions')
              .update({ status: 'answered', ai_answer: m.govt_qa.answer_text, updated_at: new Date().toISOString() })
              .eq('id', m.matched_sub_question.id)
          }
        }

        // Store unmatched Q&A as project intelligence
        const unmatchedQAs = matches.filter(m => !m.matched_sub_question || !m.approved)
        if (unmatchedQAs.length > 0) {
          for (const m of unmatchedQAs) {
            await supabase.from('govt_qa_intelligence').insert({
              task_order_id: taskOrderId,
              question_text: m.govt_qa.question_text,
              answer_text: m.govt_qa.answer_text,
              question_number: m.govt_qa.question_number,
              section_reference: m.govt_qa.section_reference,
              is_distributed: false,
              created_by: user?.id,
            }).then(() => {})
          }
        }

        setStep('complete')
      } else {
        alert('Distribution failed: ' + (result.error || 'Unknown error'))
      }
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setDistributing(false)
    }
  }

  function toggleApproval(index: number) {
    setMatches(prev => prev.map((m, i) => i === index ? { ...m, approved: !m.approved } : m))
  }

  function updateAdminNote(index: number, note: string) {
    setMatches(prev => prev.map((m, i) => i === index ? { ...m, admin_note: note } : m))
  }

  const matchedCount = matches.filter(m => m.matched_sub_question && m.confidence >= 50).length
  const approvedCount = matches.filter(m => m.approved).length

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} className="text-blue-600" />
          <div>
            <h2 className="font-semibold text-gray-900">Government Q&A Response Processing</h2>
            <p className="text-sm text-gray-500">Upload government answers, AI matches to subcontractor questions, targeted distribution</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            {['Upload', 'Review Q&A', 'Match & Distribute', 'Complete'].map((label, i) => {
              const stepKeys: typeof step[] = ['upload', 'review', 'distribute', 'complete']
              const currentIdx = stepKeys.indexOf(step)
              const isActive = i === currentIdx
              const isDone = i < currentIdx
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-0.5 ${isDone || isActive ? 'bg-blue-500' : 'bg-gray-200'}`} />}
                  <div className={`flex items-center gap-1 px-2 py-1 rounded ${isActive ? 'bg-blue-100 text-blue-700 font-medium' : isDone ? 'text-green-700' : 'text-gray-400'}`}>
                    {isDone ? <CheckCircle size={14} /> : <span className="w-5 h-5 rounded-full border text-xs flex items-center justify-center">{i + 1}</span>}
                    {label}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <FileSpreadsheet className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-sm text-gray-600 mb-1">Upload Government Q&A Response Document</p>
                <p className="text-xs text-gray-400 mb-3">Supported: Excel (.xlsx, .xls), CSV (.csv), Text (.txt)</p>
                {parsing ? (
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Loader2 size={16} className="animate-spin" /> Parsing document...
                  </div>
                ) : (
                  <label className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700">
                    Select File
                    <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                )}
                {uploadedFileName && <p className="text-xs text-gray-500 mt-2">Selected: {uploadedFileName}</p>}
              </div>

              {parseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  {parseError}
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={() => setManualEntry(!manualEntry)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {manualEntry ? 'Hide manual entry' : 'Or enter Q&A pairs manually'}
                </button>
              </div>

              {manualEntry && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Manual Q&A Entry</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Q# (optional)</label>
                      <input
                        type="text"
                        value={newQa.question_number || ''}
                        onChange={e => setNewQa(p => ({ ...p, question_number: e.target.value }))}
                        placeholder="Q1"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Section Ref (optional)</label>
                      <input
                        type="text"
                        value={newQa.section_reference || ''}
                        onChange={e => setNewQa(p => ({ ...p, section_reference: e.target.value }))}
                        placeholder="Section 3.2"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Question *</label>
                    <textarea
                      value={newQa.question_text}
                      onChange={e => setNewQa(p => ({ ...p, question_text: e.target.value }))}
                      placeholder="Government question text..."
                      rows={2}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Answer *</label>
                    <textarea
                      value={newQa.answer_text}
                      onChange={e => setNewQa(p => ({ ...p, answer_text: e.target.value }))}
                      placeholder="Government response text..."
                      rows={2}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <button
                    onClick={addManualQA}
                    disabled={!newQa.question_text.trim() || !newQa.answer_text.trim()}
                    className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    + Add Q&A Pair
                  </button>
                </div>
              )}

              {qaPairs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">{qaPairs.length} Q&A pairs ready</h4>
                  {qaPairs.slice(0, 5).map((qa, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm">
                      <span className="text-xs font-mono text-gray-400 mt-0.5">{qa.question_number || `Q${i + 1}`}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 truncate">Q: {qa.question_text}</p>
                        <p className="text-gray-500 truncate">A: {qa.answer_text}</p>
                      </div>
                      <button onClick={() => removeQA(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {qaPairs.length > 5 && <p className="text-xs text-gray-400">...and {qaPairs.length - 5} more</p>}
                  <button
                    onClick={() => setStep('review')}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Review Q&A Pairs →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review parsed Q&A */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">{qaPairs.length} Q&A Pairs Extracted</h3>
                <button onClick={() => setStep('upload')} className="text-xs text-blue-600 hover:text-blue-800">← Back to Upload</button>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                {qaPairs.map((qa, i) => (
                  <div key={i} className="border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{qa.question_number || `Q${i + 1}`}</span>
                      <button onClick={() => removeQA(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                    <p className="text-sm text-gray-800 mt-1"><strong>Q:</strong> {qa.question_text}</p>
                    <p className="text-sm text-gray-600 mt-0.5"><strong>A:</strong> {qa.answer_text}</p>
                    {qa.section_reference && <p className="text-xs text-gray-400 mt-0.5">Ref: {qa.section_reference}</p>}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-gray-500">Review the extracted Q&A pairs above. Remove any that are incorrect, then proceed to match against subcontractor questions.</p>
                <button
                  onClick={handleMatchQuestions}
                  disabled={matching || qaPairs.length === 0}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {matching ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                  AI Match to Sub Questions
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Match results & approval */}
          {step === 'distribute' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">AI Matching Results</h3>
                  <p className="text-xs text-gray-500">{matchedCount} of {matches.length} government answers matched to subcontractor questions • {approvedCount} approved for distribution</p>
                </div>
                <button onClick={() => setStep('review')} className="text-xs text-blue-600 hover:text-blue-800">← Back to Review</button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-3">
                {matches.map((m, i) => (
                  <div key={i} className={`border rounded-lg p-4 ${
                    m.matched_sub_question && m.confidence >= 70 ? 'border-green-200 bg-green-50/30' :
                    m.matched_sub_question && m.confidence >= 40 ? 'border-yellow-200 bg-yellow-50/30' :
                    'border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{m.govt_qa.question_number || `G${i + 1}`}</span>
                        {m.matched_sub_question ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            m.confidence >= 70 ? 'bg-green-100 text-green-700' :
                            m.confidence >= 40 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {m.confidence}% match
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">No match — stored as intel</span>
                        )}
                      </div>
                      {m.matched_sub_question && (
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={m.approved}
                            onChange={() => toggleApproval(i)}
                            className="rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-xs text-gray-600">Approve</span>
                        </label>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Government Q&A:</p>
                        <p className="text-sm text-gray-800"><strong>Q:</strong> {m.govt_qa.question_text}</p>
                        <p className="text-sm text-gray-600"><strong>A:</strong> {m.govt_qa.answer_text}</p>
                      </div>

                      {m.matched_sub_question && (
                        <div className="border-t border-gray-200 pt-2">
                          <p className="text-xs text-gray-500 mb-0.5">Matched Subcontractor Question:</p>
                          <p className="text-sm text-blue-800">"{m.matched_sub_question.question_text}"</p>
                          <p className="text-xs text-gray-500">— {m.matched_sub_question.company_name} ({m.matched_sub_question.contact_email || 'no email'})</p>
                          <p className="text-xs text-gray-400 italic">{m.match_reason}</p>

                          {m.approved && (
                            <input
                              type="text"
                              value={m.admin_note}
                              onChange={e => updateAdminNote(i, e.target.value)}
                              placeholder="Add context note for this subcontractor (optional)"
                              className="w-full mt-2 border border-gray-200 rounded px-2 py-1 text-xs"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-green-700">{approvedCount}</span> approved for distribution
                  {matches.filter(m => !m.matched_sub_question).length > 0 && (
                    <span className="ml-3 text-gray-400">• {matches.filter(m => !m.matched_sub_question).length} unmatched (stored as intel)</span>
                  )}
                </div>
                <button
                  onClick={handleDistribute}
                  disabled={distributing || approvedCount === 0}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {distributing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send to {approvedCount} Subcontractor{approvedCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Government Q&A Distributed</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
                Targeted responses have been sent to each subcontractor who asked a matching question.
                Unmatched Q&A pairs have been stored as project intelligence.
              </p>
              <button
                onClick={() => { setStep('upload'); setQaPairs([]); setMatches([]) }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Process another Q&A document
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
