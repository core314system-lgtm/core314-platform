import { useState, useCallback } from 'react'
import {
  Database, Search, Send, CheckCircle, Loader2, X,
  MapPin, ShieldCheck,
  Mail, Users, ToggleLeft, ToggleRight,
} from 'lucide-react'

interface MatchResult {
  sub_id: string
  company_name: string
  contact_email: string | null
  state: string | null
  city: string | null
  trade_categories: string[]
  verification_status: string
  profile_completeness: number
  small_business_types: string[]
  match_score: number
  match_reasons: string[]
}

interface MasterDbMatchPanelProps {
  sowId: string
  sowName: string
  serviceCategory: string
  projectState: string
  existingSubIds: Set<string>
  onAddSub: (subId: string) => void
  onClose: () => void
  userId: string
}

export default function MasterDbMatchPanel({
  sowId: _sowId,
  sowName,
  serviceCategory,
  projectState,
  existingSubIds,
  onAddSub,
  onClose,
  userId,
}: MasterDbMatchPanelProps) {
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sendingRfqs, setSendingRfqs] = useState(false)
  const [rfqResult, setRfqResult] = useState<{ sent: number; failed: number } | null>(null)
  const [autoSendEnabled, setAutoSendEnabled] = useState(false)
  const [minAutoScore, setMinAutoScore] = useState(70)
  const [addedSubs, setAddedSubs] = useState<Set<string>>(new Set())

  const searchMasterDb = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    setRfqResult(null)
    try {
      const trades = [serviceCategory]
      const states = projectState ? [projectState] : []

      const res = await fetch('/.netlify/functions/sub-auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          action: 'match',
          trades,
          states,
          max_results: 50,
          include_unclaimed: true,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const filtered = (data.matches || []).filter(
          (m: MatchResult) => !existingSubIds.has(m.sub_id) && !addedSubs.has(m.sub_id)
        )
        setMatches(filtered)
      }
    } catch (err) {
      console.error('Master DB match error:', err)
    }
    setLoading(false)
  }, [serviceCategory, projectState, userId, existingSubIds, addedSubs])

  const toggleSelect = (subId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(subId)) next.delete(subId)
      else next.add(subId)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === matches.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(matches.map(m => m.sub_id)))
    }
  }

  const addSelectedToSow = () => {
    for (const subId of selected) {
      onAddSub(subId)
      setAddedSubs(prev => new Set(prev).add(subId))
    }
    setMatches(prev => prev.filter(m => !selected.has(m.sub_id)))
    setSelected(new Set())
  }

  const sendRfqsToSelected = async () => {
    if (selected.size === 0) return
    setSendingRfqs(true)
    try {
      const res = await fetch('/.netlify/functions/sub-auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          action: 'invite-all',
          sub_ids: Array.from(selected),
          rfq_title: sowName,
          rfq_description: `Request for Quote: ${serviceCategory}`,
          prime_company: 'Procuvex Network',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setRfqResult({ sent: data.sent, failed: data.failed })
      }
    } catch (err) {
      console.error('RFQ send error:', err)
    }
    setSendingRfqs(false)
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-700 bg-green-100'
    if (score >= 60) return 'text-amber-700 bg-amber-100'
    return 'text-gray-700 bg-gray-100'
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-blue-600" />
          <h4 className="font-semibold text-blue-900">Find Matching Subcontractors — Master Database</h4>
        </div>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-600"><X size={18} /></button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-blue-700">
          Searching for: <span className="font-semibold">{serviceCategory}</span>
          {projectState && <span className="ml-2 text-blue-500">in {projectState}</span>}
        </div>
        <button
          onClick={searchMasterDb}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {searched ? 'Re-Search' : 'Search Master Database'}
        </button>
      </div>

      {/* Auto-Send RFQ Toggle */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-blue-100 p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoSendEnabled(!autoSendEnabled)}
            className="flex items-center gap-1.5 text-sm"
          >
            {autoSendEnabled
              ? <ToggleRight size={24} className="text-blue-600" />
              : <ToggleLeft size={24} className="text-gray-400" />
            }
            <span className={`font-medium ${autoSendEnabled ? 'text-blue-700' : 'text-gray-500'}`}>
              Auto-Send RFQ Invitations
            </span>
          </button>
          {autoSendEnabled && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <span>Min score:</span>
              <select
                value={minAutoScore}
                onChange={e => setMinAutoScore(Number(e.target.value))}
                className="border border-blue-200 rounded px-2 py-0.5 text-xs"
              >
                <option value={50}>50+</option>
                <option value={60}>60+</option>
                <option value={70}>70+</option>
                <option value={80}>80+</option>
                <option value={90}>90+</option>
              </select>
            </div>
          )}
        </div>
        <span className="text-[10px] text-gray-400 max-w-[250px] text-right">
          {autoSendEnabled
            ? `RFQs will auto-send to matches scoring ${minAutoScore}+ when you add them`
            : 'Manual — you choose who to contact'}
        </span>
      </div>

      {loading && (
        <div className="text-center py-8 text-blue-500 text-sm flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Searching 130,000+ subcontractors...
        </div>
      )}

      {searched && !loading && matches.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-sm">
          No matching subcontractors found in the master database for this trade category.
        </div>
      )}

      {matches.length > 0 && (
        <>
          {/* Bulk Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                {selected.size === matches.length ? 'Deselect All' : `Select All (${matches.length})`}
              </button>
              {selected.size > 0 && (
                <span className="text-xs text-blue-500">{selected.size} selected</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <>
                  <button
                    onClick={addSelectedToSow}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1.5"
                  >
                    <Users size={12} /> Add to SOW ({selected.size})
                  </button>
                  <button
                    onClick={sendRfqsToSelected}
                    disabled={sendingRfqs}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {sendingRfqs ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Send RFQs ({selected.size})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* RFQ Result */}
          {rfqResult && (
            <div className={`rounded-lg p-3 text-sm ${rfqResult.failed > 0 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
              <CheckCircle size={14} className="inline mr-1.5" />
              {rfqResult.sent} RFQ invitation{rfqResult.sent !== 1 ? 's' : ''} sent
              {rfqResult.failed > 0 && ` (${rfqResult.failed} failed — no email on file)`}
            </div>
          )}

          {/* Match Results */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {matches.map(match => (
              <div
                key={match.sub_id}
                className={`bg-white rounded-lg border p-3 flex items-start gap-3 transition-colors ${
                  selected.has(match.sub_id) ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected.has(match.sub_id)}
                  onChange={() => toggleSelect(match.sub_id)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                {/* Match Score */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center ${scoreColor(match.match_score)}`}>
                  <div className="text-lg font-bold leading-none">{match.match_score}</div>
                  <div className="text-[8px] uppercase tracking-wider">score</div>
                </div>

                {/* Company Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{match.company_name}</span>
                    {match.verification_status === 'verified' && (
                      <span className="flex items-center gap-0.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                        <ShieldCheck size={10} /> Verified
                      </span>
                    )}
                    {match.verification_status === 'claimed' && (
                      <span className="flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                        <CheckCircle size={10} /> Claimed
                      </span>
                    )}
                    {match.small_business_types.length > 0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                        {match.small_business_types.join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Location & Contact */}
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                    {(match.city || match.state) && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {[match.city, match.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {match.contact_email && (
                      <span className="flex items-center gap-1">
                        <Mail size={10} /> {match.contact_email}
                      </span>
                    )}
                  </div>

                  {/* Match Reasons */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {match.match_reasons.map((reason, i) => (
                      <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                        {reason}
                      </span>
                    ))}
                  </div>

                  {/* Trades */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {match.trade_categories.slice(0, 4).map((trade, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {trade}
                      </span>
                    ))}
                    {match.trade_categories.length > 4 && (
                      <span className="text-[10px] text-gray-400">+{match.trade_categories.length - 4} more</span>
                    )}
                  </div>
                </div>

                {/* Quick Add */}
                <button
                  onClick={() => {
                    onAddSub(match.sub_id)
                    setAddedSubs(prev => new Set(prev).add(match.sub_id))
                    setMatches(prev => prev.filter(m => m.sub_id !== match.sub_id))
                    setSelected(prev => {
                      const next = new Set(prev)
                      next.delete(match.sub_id)
                      return next
                    })
                  }}
                  className="flex-shrink-0 text-xs bg-green-50 text-green-700 px-2.5 py-1.5 rounded-lg hover:bg-green-100 border border-green-200 font-medium"
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
