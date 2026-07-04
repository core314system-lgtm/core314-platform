import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Target, ArrowLeft, Sparkles, DollarSign, TrendingUp,
  TrendingDown, AlertTriangle, CheckCircle,
} from 'lucide-react'

interface PTWResult {
  recommended_price_range: {
    low: number
    target: number
    high: number
    currency: string
  }
  confidence_level: string
  analysis: {
    market_rate_analysis: string
    competitive_position: string
    historical_pricing: string
    risk_factors: string[]
  }
  labor_rate_benchmarks: LaborBenchmark[]
  pricing_strategies: PricingStrategy[]
  cost_drivers: CostDriver[]
  recommendations: string[]
}

interface LaborBenchmark {
  category: string
  market_low: number
  market_avg: number
  market_high: number
  recommended: number
}

interface PricingStrategy {
  strategy_name: string
  description: string
  price_point: number
  win_probability: string
  risk_level: string
  tradeoffs: string[]
}

interface CostDriver {
  driver: string
  impact: string
  mitigation: string
}

export default function PriceToWin() {
  const { id: projectId } = useParams<{ id: string }>()
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<PTWResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Input fields
  const [contractType, setContractType] = useState('FFP')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [naicsCode, setNaicsCode] = useState('')
  const [agency, setAgency] = useState('')
  const [scope, setScope] = useState('')
  const [periodMonths, setPeriodMonths] = useState('')
  const [setAside, setSetAside] = useState('')
  const [incumbentInfo, setIncumbentInfo] = useState('')

  async function runAnalysis() {
    if (!scope.trim()) return
    setAnalyzing(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/.netlify/functions/ai-price-to-win', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          task_order_id: projectId,
          contract_type: contractType,
          estimated_value: estimatedValue ? Number(estimatedValue) : null,
          naics_code: naicsCode,
          agency,
          scope,
          period_months: periodMonths ? Number(periodMonths) : null,
          set_aside: setAside,
          incumbent_info: incumbentInfo,
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

  function formatDollars(n: number): string {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="text-blue-600" size={28} />
            Price-to-Win Analysis
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-assisted competitive pricing framework — FAR 15.101-1 best value scoring</p>
        </div>
      </div>

      {!result ? (
        <div className="space-y-6">
          {/* Input Form */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Opportunity Details</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contract Type</label>
                <select
                  value={contractType}
                  onChange={e => setContractType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                >
                  <option value="FFP">Firm Fixed Price (FFP)</option>
                  <option value="T&M">Time & Materials (T&M)</option>
                  <option value="CPFF">Cost Plus Fixed Fee (CPFF)</option>
                  <option value="CPAF">Cost Plus Award Fee (CPAF)</option>
                  <option value="CPIF">Cost Plus Incentive Fee (CPIF)</option>
                  <option value="IDIQ">IDIQ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Value ($)</label>
                <input
                  type="number"
                  value={estimatedValue}
                  onChange={e => setEstimatedValue(e.target.value)}
                  placeholder="e.g. 5000000"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">NAICS Code</label>
                <input
                  type="text"
                  value={naicsCode}
                  onChange={e => setNaicsCode(e.target.value)}
                  placeholder="e.g. 561210"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Agency</label>
                <input
                  type="text"
                  value={agency}
                  onChange={e => setAgency(e.target.value)}
                  placeholder="e.g. Department of the Air Force"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Period of Performance (months)</label>
                <input
                  type="number"
                  value={periodMonths}
                  onChange={e => setPeriodMonths(e.target.value)}
                  placeholder="e.g. 60"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Set-Aside</label>
                <select
                  value={setAside}
                  onChange={e => setSetAside(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                >
                  <option value="">Full & Open</option>
                  <option value="SB">Small Business</option>
                  <option value="8a">8(a)</option>
                  <option value="SDVOSB">SDVOSB</option>
                  <option value="WOSB">WOSB</option>
                  <option value="HUBZone">HUBZone</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Scope of Work Summary</label>
              <textarea
                value={scope}
                onChange={e => setScope(e.target.value)}
                rows={4}
                placeholder="Describe the scope of work, key deliverables, staffing requirements, etc."
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Incumbent Information (optional)</label>
              <textarea
                value={incumbentInfo}
                onChange={e => setIncumbentInfo(e.target.value)}
                rows={2}
                placeholder="Who is the current contractor? What is their contract value? Any known issues?"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={runAnalysis}
                disabled={analyzing || !scope.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {analyzing ? (
                  <><Sparkles size={16} className="animate-pulse" /> Analyzing...</>
                ) : (
                  <><Target size={16} /> Generate PTW Analysis</>
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
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">PTW Analysis Results</h2>
            <button onClick={() => setResult(null)} className="text-sm text-blue-600 hover:text-blue-800">
              New Analysis
            </button>
          </div>

          {/* Recommended Price Range */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
            <h3 className="text-sm font-medium text-blue-200 mb-2">Recommended Price Range</h3>
            <div className="grid grid-cols-3 gap-6 mb-4">
              <div className="text-center">
                <p className="text-xs text-blue-300 mb-1">Aggressive</p>
                <p className="text-2xl font-bold">{formatDollars(result.recommended_price_range.low)}</p>
                <p className="text-xs text-blue-300 mt-1 flex items-center justify-center gap-1"><TrendingDown size={10} /> Higher risk</p>
              </div>
              <div className="text-center bg-white/10 rounded-xl p-3">
                <p className="text-xs text-blue-200 mb-1">Target Price</p>
                <p className="text-3xl font-bold">{formatDollars(result.recommended_price_range.target)}</p>
                <p className="text-xs text-green-300 mt-1 flex items-center justify-center gap-1"><CheckCircle size={10} /> Optimal</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-blue-300 mb-1">Conservative</p>
                <p className="text-2xl font-bold">{formatDollars(result.recommended_price_range.high)}</p>
                <p className="text-xs text-blue-300 mt-1 flex items-center justify-center gap-1"><TrendingUp size={10} /> Lower risk</p>
              </div>
            </div>
            <div className="text-center">
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                Confidence: {result.confidence_level}
              </span>
            </div>
          </div>

          {/* Analysis Details */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Market Rate Analysis</h3>
              <p className="text-sm text-gray-600">{result.analysis.market_rate_analysis}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Competitive Position</h3>
              <p className="text-sm text-gray-600">{result.analysis.competitive_position}</p>
            </div>
          </div>

          {/* Pricing Strategies */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pricing Strategies</h3>
            <div className="grid gap-3">
              {result.pricing_strategies.map((strategy, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm text-gray-900">{strategy.strategy_name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-blue-700">{formatDollars(strategy.price_point)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        strategy.risk_level === 'Low' ? 'bg-green-100 text-green-700' :
                        strategy.risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{strategy.risk_level} Risk</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {strategy.win_probability} win prob.
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{strategy.description}</p>
                  {strategy.tradeoffs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {strategy.tradeoffs.map((t, j) => (
                        <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Labor Rate Benchmarks */}
          {result.labor_rate_benchmarks.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Labor Rate Benchmarks ($/hr)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2">Category</th>
                    <th className="pb-2 text-right">Market Low</th>
                    <th className="pb-2 text-right">Market Avg</th>
                    <th className="pb-2 text-right">Market High</th>
                    <th className="pb-2 text-right font-bold">Recommended</th>
                  </tr>
                </thead>
                <tbody>
                  {result.labor_rate_benchmarks.map((lb, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">{lb.category}</td>
                      <td className="py-2 text-right text-gray-500">${lb.market_low}</td>
                      <td className="py-2 text-right text-gray-600">${lb.market_avg}</td>
                      <td className="py-2 text-right text-gray-500">${lb.market_high}</td>
                      <td className="py-2 text-right font-bold text-blue-700">${lb.recommended}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cost Drivers */}
          {result.cost_drivers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Key Cost Drivers</h3>
              <div className="space-y-2">
                {result.cost_drivers.map((cd, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <DollarSign size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-sm text-gray-900">{cd.driver}</span>
                      <span className="mx-2 text-gray-400">—</span>
                      <span className="text-sm text-gray-600">{cd.impact}</span>
                      <p className="text-xs text-gray-500 mt-0.5">Mitigation: {cd.mitigation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-green-800 mb-2">Pricing Recommendations</h3>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                    <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
