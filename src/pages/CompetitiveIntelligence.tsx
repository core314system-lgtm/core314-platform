import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  TrendingUp, Search, Building2, DollarSign,
  ChevronDown, ChevronUp, Sparkles, AlertTriangle,
} from 'lucide-react'

interface AwardRecord {
  vendor_name: string
  contract_number: string
  agency: string
  description: string
  naics_code: string
  award_date: string
  dollars_obligated: number
  contract_type: string
  set_aside: string
  place_of_performance: string
}

interface CompetitorProfile {
  name: string
  total_awards: number
  total_dollars: number
  primary_agencies: string[]
  primary_naics: string[]
  avg_award_size: number
  win_rate_estimate: string
  strengths: string[]
  weaknesses: string[]
}

interface IntelResult {
  awards: AwardRecord[]
  competitors: CompetitorProfile[]
  market_summary: {
    total_awards: number
    total_dollars: number
    avg_award_size: number
    top_agencies: string[]
    trend: string
  }
  recommendations: string[]
}

export default function CompetitiveIntelligence() {
  const [naicsCode, setNaicsCode] = useState('')
  const [agency, setAgency] = useState('')
  const [keyword, setKeyword] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<IntelResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null)
  const [showAwards, setShowAwards] = useState(false)

  async function runAnalysis() {
    if (!naicsCode.trim() && !keyword.trim()) return
    setAnalyzing(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/.netlify/functions/ai-competitive-intel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          naics_code: naicsCode,
          agency: agency,
          keyword: keyword,
        }),
      })

      if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`)
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-blue-600" size={28} />
          Competitive Intelligence
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-powered analysis of federal award data — identify competitors, market trends, and positioning strategies
        </p>
      </div>

      {/* Search Parameters */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Search Parameters</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">NAICS Code</label>
            <input
              type="text"
              value={naicsCode}
              onChange={e => setNaicsCode(e.target.value)}
              placeholder="e.g. 561210"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Agency (optional)</label>
            <input
              type="text"
              value={agency}
              onChange={e => setAgency(e.target.value)}
              placeholder="e.g. Department of Defense"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Keywords</label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="e.g. facility maintenance"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Analysis uses AI to synthesize competitive landscape from public federal procurement data
          </p>
          <button
            onClick={runAnalysis}
            disabled={analyzing || (!naicsCode.trim() && !keyword.trim())}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {analyzing ? (
              <><Sparkles size={16} className="animate-pulse" /> Analyzing Market...</>
            ) : (
              <><Search size={16} /> Analyze Competition</>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Market Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.market_summary.total_awards}</p>
              <p className="text-xs text-gray-500 mt-1">Total Awards</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                ${(result.market_summary.total_dollars / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-gray-500 mt-1">Total Obligated</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                ${(result.market_summary.avg_award_size / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-gray-500 mt-1">Avg Award Size</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.competitors.length}</p>
              <p className="text-xs text-gray-500 mt-1">Competitors Identified</p>
            </div>
          </div>

          {/* Market Trend */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-800 mb-1">Market Trend</h3>
            <p className="text-sm text-blue-700">{result.market_summary.trend}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {result.market_summary.top_agencies.map((a, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{a}</span>
              ))}
            </div>
          </div>

          {/* Competitor Profiles */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Competitor Profiles</h2>
            <div className="space-y-3">
              {result.competitors.map((comp, i) => (
                <div key={i} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedCompetitor(expandedCompetitor === comp.name ? null : comp.name)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-gray-400" />
                        <span className="font-medium text-sm text-gray-900">{comp.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">{comp.total_awards} awards</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <DollarSign size={10} /> ${(comp.total_dollars / 1000000).toFixed(1)}M
                      </span>
                    </div>
                    {expandedCompetitor === comp.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedCompetitor === comp.name && (
                    <div className="border-t border-gray-100 p-3 grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Strengths</h4>
                        <ul className="text-sm text-gray-700 space-y-0.5">
                          {comp.strengths.map((s, j) => <li key={j}>&bull; {s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Potential Weaknesses</h4>
                        <ul className="text-sm text-gray-700 space-y-0.5">
                          {comp.weaknesses.map((w, j) => <li key={j}>&bull; {w}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Primary Agencies</h4>
                        <div className="flex flex-wrap gap-1">
                          {comp.primary_agencies.map((a, j) => (
                            <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{a}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Primary NAICS</h4>
                        <div className="flex flex-wrap gap-1">
                          {comp.primary_naics.map((n, j) => (
                            <span key={j} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{n}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-green-800 mb-2">Strategic Recommendations</h3>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-green-700">&bull; {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw Awards Toggle */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <button
              onClick={() => setShowAwards(!showAwards)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700"
            >
              {showAwards ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Award Details ({result.awards.length} records)
            </button>
            {showAwards && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-3">Vendor</th>
                      <th className="pb-2 pr-3">Agency</th>
                      <th className="pb-2 pr-3">NAICS</th>
                      <th className="pb-2 pr-3">Value</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.awards.map((a, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-3 font-medium text-gray-900">{a.vendor_name}</td>
                        <td className="py-2 pr-3 text-gray-600">{a.agency}</td>
                        <td className="py-2 pr-3">{a.naics_code}</td>
                        <td className="py-2 pr-3">${(a.dollars_obligated / 1000000).toFixed(2)}M</td>
                        <td className="py-2 pr-3">{a.contract_type}</td>
                        <td className="py-2">{a.award_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
