import { useState, useEffect } from 'react'
import { Zap, RefreshCw, AlertCircle, CheckCircle, Clock, FileText, Users, DollarSign, Shield, Target } from 'lucide-react'

interface SmartRecommendationsProps {
  project: Record<string, unknown>
  documentCount: number
  analysisComplete: boolean
  subAssignments: number
}

interface Recommendation {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: string
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  documents: <FileText size={14} className="text-blue-500" />,
  analysis: <Target size={14} className="text-purple-500" />,
  pricing: <DollarSign size={14} className="text-green-500" />,
  compliance: <Shield size={14} className="text-indigo-500" />,
  team: <Users size={14} className="text-orange-500" />,
  timeline: <Clock size={14} className="text-red-500" />,
  strategy: <Zap size={14} className="text-amber-500" />,
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'border-l-red-400 bg-red-50/40',
  medium: 'border-l-yellow-400 bg-yellow-50/30',
  low: 'border-l-blue-400 bg-blue-50/30',
}

export default function SmartRecommendations({ project, documentCount, analysisComplete, subAssignments }: SmartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  async function loadRecommendations() {
    setLoading(true)
    setDismissed(new Set())
    try {
      const res = await fetch('/.netlify/functions/smart-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, documentCount, analysisComplete, subAssignments }),
      })
      if (res.ok) {
        const data = await res.json()
        setRecommendations(data.recommendations || [])
      }
    } catch { /* silently fail */ }
    setLoading(false)
  }

  useEffect(() => {
    if (!['awarded', 'not_awarded'].includes(project.status as string)) {
      loadRecommendations()
    }
  }, [project.status, documentCount, analysisComplete, subAssignments])

  if (['awarded', 'not_awarded'].includes(project.status as string)) return null

  const visibleRecs = recommendations.filter((_, i) => !dismissed.has(i))
  if (visibleRecs.length === 0 && !loading) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Zap size={16} className="text-amber-500" />
          Smart Recommendations
        </h3>
        <button
          onClick={loadRecommendations}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading && recommendations.length === 0 ? (
        <div className="text-xs text-gray-400 py-2">Analyzing project...</div>
      ) : (
        <div className="space-y-2">
          {recommendations.map((rec, i) => {
            if (dismissed.has(i)) return null
            return (
              <div
                key={i}
                className={`border-l-3 rounded-r-lg px-3 py-2 ${PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium}`}
                style={{ borderLeftWidth: '3px' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {CATEGORY_ICONS[rec.category] || <AlertCircle size={14} className="text-gray-400" />}
                    <div>
                      <p className="text-xs font-medium text-gray-800">{rec.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDismissed(prev => new Set([...prev, i]))}
                    className="text-gray-300 hover:text-gray-500 ml-2"
                    title="Dismiss"
                  >
                    <CheckCircle size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
