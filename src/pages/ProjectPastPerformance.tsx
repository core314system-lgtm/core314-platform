import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../contexts/OrgContext'
import {
  Award, ArrowLeft, Sparkles, Plus, X, Check, Loader2,
  Building2, DollarSign, ChevronDown, ChevronUp, LinkIcon, Unlink,
  Search, Star,
} from 'lucide-react'
import FeatureGuidance from '../components/FeatureGuidance'

interface Citation {
  id: string
  org_id: string
  contract_title: string
  contract_number: string | null
  agency: string | null
  client_name: string | null
  contract_type: string | null
  naics_code: string | null
  set_aside: string | null
  contract_value: number | null
  period_of_performance_start: string | null
  period_of_performance_end: string | null
  relevance_tags: string[]
  service_categories: string[]
  description: string | null
  our_role: string | null
  key_personnel: string[]
  cpars_rating: string | null
  past_performance_narrative: string | null
  lessons_learned: string | null
  created_at: string
}

interface LinkedCitation {
  id: string
  task_order_id: string
  citation_id: string
  relevance_score: number
  relevance_notes: string | null
  created_at: string
}

interface RecommendedCitation {
  citation: Citation
  score: number
  reasons: string[]
}

const CPARS_LABELS: Record<string, { label: string; color: string }> = {
  exceptional: { label: 'Exceptional', color: 'bg-green-100 text-green-800' },
  very_good: { label: 'Very Good', color: 'bg-blue-100 text-blue-800' },
  satisfactory: { label: 'Satisfactory', color: 'bg-yellow-100 text-yellow-800' },
  marginal: { label: 'Marginal', color: 'bg-orange-100 text-orange-800' },
  unsatisfactory: { label: 'Unsatisfactory', color: 'bg-red-100 text-red-800' },
}

const ROLE_LABELS: Record<string, string> = {
  prime: 'Prime Contractor',
  subcontractor: 'Subcontractor',
  jv_partner: 'JV Partner',
  mentor: 'Mentor',
  protege: 'Protege',
}

export default function ProjectPastPerformance() {
  const { id } = useParams<{ id: string }>()
  const { currentOrg } = useOrg()
  const [projectTitle, setProjectTitle] = useState('')
  const [projectNaics, setProjectNaics] = useState('')
  const [projectSetAside, setProjectSetAside] = useState('')
  const [projectValue, setProjectValue] = useState('')
  const [projectTitle2, setProjectTitle2] = useState('')
  const [allCitations, setAllCitations] = useState<Citation[]>([])
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [linkedData, setLinkedData] = useState<LinkedCitation[]>([])
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<RecommendedCitation[]>([])
  const [recommending, setRecommending] = useState(false)
  const [showUnlinked, setShowUnlinked] = useState(false)
  const [searchUnlinked, setSearchUnlinked] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  useEffect(() => {
    if (id && currentOrg?.id) {
      fetchAll()
    }
  }, [id, currentOrg?.id])

  async function fetchAll() {
    setLoading(true)

    // Fetch project info
    const { data: project } = await supabase
      .from('task_orders')
      .select('title, naics_code, set_aside, estimated_value, site_name')
      .eq('id', id!)
      .single()
    if (project) {
      setProjectTitle(project.title || '')
      setProjectTitle2(project.site_name || '')
      setProjectNaics(project.naics_code || '')
      setProjectSetAside(project.set_aside || '')
      setProjectValue(project.estimated_value || '')
    }

    // Fetch all citations for the org
    const { data: citations } = await supabase
      .from('past_performance_citations')
      .select('*')
      .eq('org_id', currentOrg!.id)
      .order('created_at', { ascending: false })
    setAllCitations((citations as Citation[]) || [])

    // Fetch linked citations
    const { data: links } = await supabase
      .from('project_past_performance')
      .select('*')
      .eq('task_order_id', id!)
    setLinkedData((links as LinkedCitation[]) || [])
    setLinkedIds(new Set((links || []).map((l: LinkedCitation) => l.citation_id)))

    setLoading(false)
  }

  async function linkCitation(citationId: string, score?: number, notes?: string) {
    if (!id) return
    setLinkingId(citationId)
    await supabase.from('project_past_performance').insert({
      task_order_id: id,
      citation_id: citationId,
      relevance_score: score || 0,
      relevance_notes: notes || null,
    })
    setLinkedIds(prev => new Set([...prev, citationId]))
    const { data: links } = await supabase
      .from('project_past_performance')
      .select('*')
      .eq('task_order_id', id)
    setLinkedData((links as LinkedCitation[]) || [])
    setLinkingId(null)
  }

  async function unlinkCitation(citationId: string) {
    if (!id) return
    setLinkingId(citationId)
    await supabase
      .from('project_past_performance')
      .delete()
      .eq('task_order_id', id)
      .eq('citation_id', citationId)
    setLinkedIds(prev => {
      const next = new Set(prev)
      next.delete(citationId)
      return next
    })
    setLinkedData(prev => prev.filter(l => l.citation_id !== citationId))
    setLinkingId(null)
  }

  async function handleAiRecommend() {
    if (allCitations.length === 0) return
    setRecommending(true)
    setRecommendations([])

    try {
      const citationsSummary = allCitations.map(c => ({
        id: c.id,
        contract_title: c.contract_title,
        agency: c.agency,
        naics_code: c.naics_code,
        contract_type: c.contract_type,
        contract_value: c.contract_value,
        set_aside: c.set_aside,
        relevance_tags: c.relevance_tags,
        service_categories: c.service_categories,
        cpars_rating: c.cpars_rating,
        our_role: c.our_role,
        period_of_performance_end: c.period_of_performance_end,
        description: c.description?.substring(0, 200),
      }))

      const res = await fetch('/.netlify/functions/ai-past-performance-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: {
            title: projectTitle,
            site_name: projectTitle2,
            naics_code: projectNaics,
            set_aside: projectSetAside,
            estimated_value: projectValue,
          },
          citations: citationsSummary,
        }),
      })

      if (!res.ok) {
        console.error('AI recommendation failed')
        setRecommending(false)
        return
      }

      const data = await res.json()
      if (data.recommendations && Array.isArray(data.recommendations)) {
        const mapped: RecommendedCitation[] = data.recommendations
          .map((r: { citation_id: string; score: number; reasons: string[] }) => {
            const citation = allCitations.find(c => c.id === r.citation_id)
            if (!citation) return null
            return { citation, score: r.score, reasons: r.reasons }
          })
          .filter(Boolean) as RecommendedCitation[]
        setRecommendations(mapped)
      }
    } catch (err) {
      console.error('AI recommendation error:', err)
    }
    setRecommending(false)
  }

  const linkedCitations = allCitations.filter(c => linkedIds.has(c.id))
  const unlinkedCitations = allCitations
    .filter(c => !linkedIds.has(c.id))
    .filter(c => {
      if (!searchUnlinked) return true
      const q = searchUnlinked.toLowerCase()
      return c.contract_title.toLowerCase().includes(q) ||
        c.agency?.toLowerCase().includes(q) ||
        c.naics_code?.toLowerCase().includes(q) ||
        c.service_categories.some(s => s.toLowerCase().includes(q))
    })

  function CitationCard({ citation, isLinked, relevanceScore, relevanceReasons }: {
    citation: Citation
    isLinked: boolean
    relevanceScore?: number
    relevanceReasons?: string[]
  }) {
    const isExpanded = expandedId === citation.id
    return (
      <div className={`border rounded-xl transition-colors ${isLinked ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setExpandedId(isExpanded ? null : citation.id)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {relevanceScore !== undefined && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  relevanceScore >= 80 ? 'bg-green-100 text-green-800' :
                  relevanceScore >= 60 ? 'bg-blue-100 text-blue-800' :
                  relevanceScore >= 40 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  <Star size={10} /> {relevanceScore}%
                </span>
              )}
              <h3 className="font-semibold text-gray-900 truncate">{citation.contract_title}</h3>
              {citation.cpars_rating && CPARS_LABELS[citation.cpars_rating] && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CPARS_LABELS[citation.cpars_rating].color}`}>
                  {CPARS_LABELS[citation.cpars_rating].label}
                </span>
              )}
              {citation.our_role && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {ROLE_LABELS[citation.our_role] || citation.our_role}
                </span>
              )}
              {isLinked && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Linked
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {citation.agency && <span className="flex items-center gap-1"><Building2 size={12} /> {citation.agency}</span>}
              {citation.contract_type && <span>{citation.contract_type}</span>}
              {citation.contract_value && (
                <span className="flex items-center gap-1"><DollarSign size={12} /> ${(citation.contract_value / 1000000).toFixed(1)}M</span>
              )}
              {citation.naics_code && <span>NAICS: {citation.naics_code}</span>}
            </div>
            {relevanceReasons && relevanceReasons.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {relevanceReasons.map((r, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{r}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            {isLinked ? (
              <button
                onClick={e => { e.stopPropagation(); unlinkCitation(citation.id) }}
                disabled={linkingId === citation.id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 disabled:opacity-50"
              >
                {linkingId === citation.id ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                Remove
              </button>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); linkCitation(citation.id, relevanceScore, relevanceReasons?.join(', ')) }}
                disabled={linkingId === citation.id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 rounded-lg border border-green-200 disabled:opacity-50"
              >
                {linkingId === citation.id ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />}
                Link
              </button>
            )}
            {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {citation.description && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</h4>
                <p className="text-sm text-gray-700">{citation.description}</p>
              </div>
            )}
            {citation.past_performance_narrative && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Performance Narrative</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">{citation.past_performance_narrative}</p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {citation.period_of_performance_start && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">POP Start</h4>
                  <p className="text-sm text-gray-700">{new Date(citation.period_of_performance_start).toLocaleDateString()}</p>
                </div>
              )}
              {citation.period_of_performance_end && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">POP End</h4>
                  <p className="text-sm text-gray-700">{new Date(citation.period_of_performance_end).toLocaleDateString()}</p>
                </div>
              )}
              {citation.set_aside && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Set-Aside</h4>
                  <p className="text-sm text-gray-700">{citation.set_aside}</p>
                </div>
              )}
              {citation.client_name && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Client</h4>
                  <p className="text-sm text-gray-700">{citation.client_name}</p>
                </div>
              )}
            </div>
            {citation.relevance_tags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {citation.relevance_tags.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {citation.service_categories.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Service Categories</h4>
                <div className="flex flex-wrap gap-1">
                  {citation.service_categories.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {citation.key_personnel.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Key Personnel</h4>
                <div className="flex flex-wrap gap-1">
                  {citation.key_personnel.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="max-w-7xl mx-auto text-center py-20 text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Link to={`/projects/${id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4">
        <ArrowLeft size={16} /> Back to Project
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="text-blue-600" size={28} />
            Project Past Performance
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {projectTitle} — {linkedCitations.length} citation{linkedCitations.length !== 1 ? 's' : ''} linked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAiRecommend}
            disabled={recommending || allCitations.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
          >
            {recommending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {recommending ? 'Analyzing...' : 'AI Recommend'}
          </button>
          <button
            onClick={() => setShowUnlinked(!showUnlinked)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} /> Browse Library
          </button>
        </div>
      </div>

      <FeatureGuidance
        title="Past Performance for This Project"
        description="Link relevant past performance citations from your master library to this project. AI can analyze your library and recommend the most relevant citations based on NAICS, agency, scope, and contract value."
        storageKey="project_past_performance"
        accentColor="blue"
        steps={[
          { title: 'Click "AI Recommend"', description: 'AI analyzes your project requirements against your entire past performance library and ranks citations by relevance score.' },
          { title: 'Review recommendations', description: 'Each recommended citation shows a relevance score (0-100%) and specific reasons why it matches this project.' },
          { title: 'Link citations', description: 'Click "Link" to attach recommended citations to this project. They will be available for your proposal past performance volume.' },
          { title: 'Browse manually', description: 'Click "Browse Library" to search and link any citation from your master library.' },
        ]}
      />

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-purple-600" size={18} />
            <h2 className="font-semibold text-gray-900">AI Recommendations</h2>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              {recommendations.length} match{recommendations.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {recommendations.map(rec => (
              <CitationCard
                key={rec.citation.id}
                citation={rec.citation}
                isLinked={linkedIds.has(rec.citation.id)}
                relevanceScore={rec.score}
                relevanceReasons={rec.reasons}
              />
            ))}
          </div>
        </div>
      )}

      {recommending && (
        <div className="text-center py-12 mb-6">
          <Loader2 className="mx-auto text-purple-600 animate-spin mb-3" size={40} />
          <p className="font-medium text-gray-900">Analyzing your library...</p>
          <p className="text-sm text-gray-500 mt-1">
            AI is matching {allCitations.length} citation{allCitations.length !== 1 ? 's' : ''} against this project's requirements
          </p>
        </div>
      )}

      {/* Linked Citations */}
      <div className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Check className="text-green-600" size={18} />
          Linked Citations ({linkedCitations.length})
        </h2>
        {linkedCitations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
            <Award className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-sm text-gray-500">
              No citations linked yet. Click "AI Recommend" to find relevant past performance, or "Browse Library" to search manually.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedCitations.map(c => {
              const link = linkedData.find(l => l.citation_id === c.id)
              return (
                <CitationCard
                  key={c.id}
                  citation={c}
                  isLinked={true}
                  relevanceScore={link?.relevance_score || undefined}
                  relevanceReasons={link?.relevance_notes ? link.relevance_notes.split(', ') : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Browse Library */}
      {showUnlinked && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Search className="text-blue-600" size={18} />
              Browse Library ({unlinkedCitations.length} available)
            </h2>
            <button onClick={() => setShowUnlinked(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={16} className="text-gray-400" />
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by title, agency, NAICS, service category..."
              value={searchUnlinked}
              onChange={e => setSearchUnlinked(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            />
          </div>
          {unlinkedCitations.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-500">
                {allCitations.length === linkedCitations.length
                  ? 'All citations are already linked to this project.'
                  : 'No matching citations found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {unlinkedCitations.map(c => (
                <CitationCard key={c.id} citation={c} isLinked={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {allCitations.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Award className="mx-auto text-gray-300 mb-3" size={48} />
          <h3 className="font-semibold text-gray-700 mb-2">No Citations in Library</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add past performance citations to your organization's library first, then come back to link them to this project.
          </p>
          <Link
            to="/past-performance"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Award size={16} /> Go to Past Performance Library
          </Link>
        </div>
      )}
    </div>
  )
}
