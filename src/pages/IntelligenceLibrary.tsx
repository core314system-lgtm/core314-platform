import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadAllDebriefs, loadIntelligence, type Debrief, type IntelligenceSummary } from '../lib/debriefStorage'
import {
  Brain, TrendingUp, TrendingDown, Target, Users, DollarSign,
  BookOpen, Award, XCircle, BarChart3, Shield, Lightbulb,
  ChevronDown, ChevronUp, Activity, AlertTriangle,
} from 'lucide-react'

const OUTCOME_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  awarded: { bg: 'bg-green-100', text: 'text-green-700', label: 'Won' },
  not_awarded: { bg: 'bg-red-100', text: 'text-red-700', label: 'Lost' },
  no_bid: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'No Bid' },
  withdrawn: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Withdrawn' },
}

export default function IntelligenceLibrary() {
  const [debriefs, setDebriefs] = useState<Debrief[]>([])
  const [intelligence, setIntelligence] = useState<IntelligenceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'debriefs' | 'competitors' | 'insights'>('overview')
  const [expandedDebrief, setExpandedDebrief] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [allDebriefs, intel] = await Promise.all([loadAllDebriefs(), loadIntelligence()])
    setDebriefs(allDebriefs)
    setIntelligence(intel)
    setLoading(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading intelligence data...</div>

  const maturityColors: Record<string, string> = {
    early: 'bg-gray-200 text-gray-700',
    developing: 'bg-blue-100 text-blue-700',
    mature: 'bg-green-100 text-green-700',
    advanced: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="text-purple-600" size={28} />
            Intelligence Library
          </h1>
          <p className="text-sm text-gray-500">Historical insights, competitive intelligence, and lessons learned</p>
        </div>
        {intelligence && (
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${maturityColors[intelligence.data_maturity]}`}>
            <Activity size={12} className="inline mr-1" />
            Data Maturity: {intelligence.data_maturity.charAt(0).toUpperCase() + intelligence.data_maturity.slice(1)}
          </div>
        )}
      </div>

      {/* Data Maturity Banner */}
      {intelligence && intelligence.data_maturity === 'early' && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
          <Lightbulb className="text-purple-500 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-medium text-purple-900">Building Your Intelligence</p>
            <p className="text-xs text-purple-700 mt-1">
              {intelligence.data_maturity_description} The system learns from every debrief you add.
              As you record more bid outcomes, the AI recommendations will become more accurate and personalized.
            </p>
          </div>
        </div>
      )}

      {/* No data state */}
      {debriefs.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Brain className="mx-auto text-gray-300 mb-4" size={48} />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No Debrief Data Yet</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Start by adding a debrief to any completed project. Go to a project&apos;s detail page and click &quot;Add Debrief&quot;.
            The system will learn from every outcome to provide smarter recommendations over time.
          </p>
          <Link to="/projects" className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">
            <BookOpen size={16} /> View Projects
          </Link>
        </div>
      )}

      {debriefs.length > 0 && (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-6">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'debriefs', label: `Debriefs (${debriefs.length})`, icon: BookOpen },
                { id: 'competitors', label: 'Competitors', icon: Users },
                { id: 'insights', label: 'AI Insights', icon: Lightbulb },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && intelligence && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="text-blue-500" size={16} />
                    <span className="text-xs text-gray-500">Total Bids</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{intelligence.total_bids}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="text-green-500" size={16} />
                    <span className="text-xs text-gray-500">Wins</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{intelligence.wins}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="text-red-500" size={16} />
                    <span className="text-xs text-gray-500">Losses</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{intelligence.losses}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="text-purple-500" size={16} />
                    <span className="text-xs text-gray-500">Win Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{intelligence.win_rate}%</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="text-amber-500" size={16} />
                    <span className="text-xs text-gray-500">No Bids</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-600">{intelligence.no_bids}</p>
                </div>
              </div>

              {/* Win/Loss Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Loss Reasons */}
                {intelligence.top_loss_reasons.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingDown className="text-red-500" size={18} /> Top Loss Reasons
                    </h3>
                    <div className="space-y-3">
                      {intelligence.top_loss_reasons.map((r, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-700">{r.reason}</span>
                              <span className="text-xs text-gray-500">{r.count}x</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-red-400 rounded-full h-2" style={{ width: `${(r.count / intelligence.losses) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Strengths */}
                {intelligence.top_strengths.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="text-green-500" size={18} /> Most Common Strengths
                    </h3>
                    <div className="space-y-3">
                      {intelligence.top_strengths.map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-700">{s.strength}</span>
                              <span className="text-xs text-gray-500">{s.count}x</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-green-400 rounded-full h-2" style={{ width: `${(s.count / debriefs.length) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Insights */}
              {intelligence.pricing_insights.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="text-blue-500" size={18} /> Pricing Insights
                  </h3>
                  <ul className="space-y-2">
                    {intelligence.pricing_insights.map((p, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Debriefs Tab */}
          {activeTab === 'debriefs' && (
            <div className="space-y-3">
              {debriefs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(d => {
                const style = OUTCOME_STYLES[d.outcome] || OUTCOME_STYLES.withdrawn
                const isExpanded = expandedDebrief === d.task_order_id
                return (
                  <div key={d.task_order_id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <button onClick={() => setExpandedDebrief(isExpanded ? null : d.task_order_id)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left">
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <div>
                          <h3 className="font-medium text-gray-900">{d.task_order_title}</h3>
                          <p className="text-xs text-gray-500">
                            {d.region && `${d.region} • `}
                            {d.service_categories.join(', ')}
                            {d.award_date && ` • ${new Date(d.award_date).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {d.our_proposed_price && (
                          <span className="text-sm text-gray-600">${d.our_proposed_price.toLocaleString()}</span>
                        )}
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
                        {/* Pricing row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {d.our_proposed_price && (
                            <div><span className="text-xs text-gray-500">Our Price</span><p className="font-medium">${d.our_proposed_price.toLocaleString()}</p></div>
                          )}
                          {d.final_award_price && (
                            <div><span className="text-xs text-gray-500">Award Price</span><p className="font-medium">${d.final_award_price.toLocaleString()}</p></div>
                          )}
                          {d.winning_competitor && (
                            <div><span className="text-xs text-gray-500">Winner</span><p className="font-medium">{d.winning_competitor}</p></div>
                          )}
                          {d.winning_competitor_price && (
                            <div><span className="text-xs text-gray-500">Winning Price</span><p className="font-medium">${d.winning_competitor_price.toLocaleString()}</p></div>
                          )}
                        </div>

                        {d.loss_reasons.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-red-600">Loss Reasons:</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {d.loss_reasons.map(r => <span key={r} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">{r}</span>)}
                            </div>
                          </div>
                        )}
                        {d.strengths.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-green-600">Strengths:</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {d.strengths.map(s => <span key={s} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{s}</span>)}
                            </div>
                          </div>
                        )}
                        {d.lessons_learned && (
                          <div>
                            <span className="text-xs font-medium text-gray-600">Lessons Learned:</span>
                            <p className="text-sm text-gray-700 mt-1">{d.lessons_learned}</p>
                          </div>
                        )}
                        {d.what_to_repeat && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <span className="text-xs font-medium text-green-700">What to Repeat:</span>
                            <p className="text-sm text-green-800 mt-1">{d.what_to_repeat}</p>
                          </div>
                        )}
                        {d.what_to_change && (
                          <div className="bg-red-50 rounded-lg p-3">
                            <span className="text-xs font-medium text-red-700">What to Change:</span>
                            <p className="text-sm text-red-800 mt-1">{d.what_to_change}</p>
                          </div>
                        )}
                        <div className="text-right">
                          <Link to={`/projects/${d.task_order_id}/debrief`} className="text-sm text-blue-600 hover:underline">
                            Edit Debrief →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Competitors Tab */}
          {activeTab === 'competitors' && (
            <div className="space-y-4">
              {intelligence && intelligence.competitors.length > 0 ? (
                intelligence.competitors.map((c, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Shield className="text-blue-500" size={18} />
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded">
                          Beat us: {c.wins_against_us}x
                        </span>
                        <span className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded">
                          We beat them: {c.losses_against_us}x
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {c.known_services.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-500">Known Services:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.known_services.map(s => <span key={s} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{s}</span>)}
                          </div>
                        </div>
                      )}
                      {c.known_regions.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-500">Known Regions:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.known_regions.map(r => <span key={r} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{r}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <Users className="mx-auto text-gray-300 mb-3" size={36} />
                  <p className="text-sm text-gray-500">No competitor data yet. Add debriefs with competitor information to build your competitive intelligence.</p>
                </div>
              )}
            </div>
          )}

          {/* AI Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
                <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                  <Brain className="text-purple-600" size={20} />
                  AI-Generated Insights
                </h3>
                <p className="text-xs text-purple-700 mb-4">
                  These insights are automatically generated from your debrief data and historical patterns. They become more accurate as you add more data.
                </p>

                {intelligence && (
                  <div className="space-y-4">
                    {/* Pricing */}
                    {intelligence.pricing_insights.length > 0 && (
                      <div className="bg-white/70 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
                          <DollarSign size={14} /> Pricing
                        </h4>
                        <ul className="space-y-1">
                          {intelligence.pricing_insights.map((p, i) => (
                            <li key={i} className="text-sm text-gray-700">• {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Win Rate Analysis */}
                    <div className="bg-white/70 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
                        <Target size={14} /> Win Rate Analysis
                      </h4>
                      <p className="text-sm text-gray-700">
                        Your overall win rate is <strong>{intelligence.win_rate}%</strong> across {intelligence.total_bids} bids.
                        {intelligence.win_rate >= 50
                          ? ' This is above the industry average of ~30-40% for government contracts.'
                          : intelligence.win_rate >= 30
                          ? ' This is within the typical range for government contracts (30-40%).'
                          : ' Consider being more selective about which opportunities to bid on.'}
                      </p>
                    </div>

                    {/* Subcontractor */}
                    {intelligence.sub_insights.length > 0 && (
                      <div className="bg-white/70 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
                          <Users size={14} /> Subcontractor Intelligence
                        </h4>
                        <ul className="space-y-1">
                          {intelligence.sub_insights.map((s, i) => (
                            <li key={i} className="text-sm text-gray-700">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Competitive */}
                    {intelligence.competitors.length > 0 && (
                      <div className="bg-white/70 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
                          <AlertTriangle size={14} /> Competitive Landscape
                        </h4>
                        <ul className="space-y-1">
                          {intelligence.competitors.slice(0, 3).map((c, i) => (
                            <li key={i} className="text-sm text-gray-700">
                              • <strong>{c.name}</strong>: {c.wins_against_us > c.losses_against_us
                                ? `Has beaten us ${c.wins_against_us} time(s). Consider different strategies when competing against them.`
                                : `We have a winning record against them (${c.losses_against_us} win(s) vs ${c.wins_against_us} loss(es)).`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Lessons by Category */}
                    {Object.keys(intelligence.lessons_by_category).length > 0 && (
                      <div className="bg-white/70 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
                          <BookOpen size={14} /> Lessons by Service Category
                        </h4>
                        {Object.entries(intelligence.lessons_by_category).map(([cat, lessons]) => (
                          <div key={cat} className="mb-3">
                            <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded">{cat}</span>
                            <ul className="mt-1 space-y-1">
                              {lessons.slice(0, 3).map((l, i) => (
                                <li key={i} className="text-xs text-gray-600 pl-3">— {l}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
