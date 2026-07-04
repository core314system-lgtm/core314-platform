import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, X, Award, Truck, UserCheck, TrendingUp,
  Shield, Palette, FileText, Target, BookOpen,
} from 'lucide-react'
import { getOnboardingState } from '../lib/onboarding'

interface DiscoveryItem {
  id: string
  label: string
  description: string
  path: string
  icon: React.ElementType
  projectScoped?: boolean
}

const DISCOVERY_ITEMS: DiscoveryItem[] = [
  {
    id: 'past_performance',
    label: 'Past Performance Library',
    description: 'Upload documents for AI extraction or manually build a citation library — CPARS ratings, contract history, and reusable narratives.',
    path: '/past-performance',
    icon: Award,
  },
  {
    id: 'contract_vehicles',
    label: 'Contract Vehicles',
    description: 'Track your GSA Schedules, GWACs, IDIQs, and BPAs — monitor expirations and match to opportunities.',
    path: '/contract-vehicles',
    icon: Truck,
  },
  {
    id: 'labor_categories',
    label: 'Personnel & LCAT Database',
    description: 'Define labor categories with rate ranges and track key personnel availability and clearances.',
    path: '/labor-categories',
    icon: UserCheck,
  },
  {
    id: 'market_intel',
    label: 'Market Intelligence',
    description: 'Analyze federal award data by NAICS code — identify competitors, market trends, and positioning strategies.',
    path: '/competitive-intelligence',
    icon: TrendingUp,
  },
  {
    id: 'capture_gates',
    label: 'Capture Gate Reviews',
    description: 'Shipley-aligned GO/NO-GO decision gates — available inside each project under Step 3.',
    path: '/projects',
    icon: Shield,
    projectScoped: true,
  },
  {
    id: 'color_team',
    label: 'Color Team Reviews',
    description: 'Schedule Pink, Red, Gold, Blue, and Black Hat proposal reviews — available inside each project.',
    path: '/projects',
    icon: Palette,
    projectScoped: true,
  },
  {
    id: 'sb_plan',
    label: 'SB Subcontracting Plans',
    description: 'Auto-generate FAR 52.219-9 compliant plans using your subcontractor network — available per project.',
    path: '/projects',
    icon: FileText,
    projectScoped: true,
  },
  {
    id: 'section_lm',
    label: 'Section L/M Analysis',
    description: 'Paste RFP text and let AI extract evaluation factors, weights, and proposal structure — per project.',
    path: '/projects',
    icon: BookOpen,
    projectScoped: true,
  },
  {
    id: 'price_to_win',
    label: 'Price-to-Win Analysis',
    description: 'AI-powered pricing recommendations with win probability estimates — available per project.',
    path: '/projects',
    icon: Target,
    projectScoped: true,
  },
]

const STORAGE_KEY = 'procuvex_discovery_dismissed'

export default function DiscoveryPrompts() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })
  const [visitedPages, setVisitedPages] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('procuvex_visited_features')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [expanded, setExpanded] = useState(true)

  const onboardingState = getOnboardingState()

  useEffect(() => {
    function trackVisit() {
      const path = window.location.pathname
      const featureRoutes: Record<string, string> = {
        '/past-performance': 'past_performance',
        '/contract-vehicles': 'contract_vehicles',
        '/labor-categories': 'labor_categories',
        '/competitive-intelligence': 'market_intel',
      }
      const projectRoutes: Record<string, string> = {
        '/capture-gates': 'capture_gates',
        '/color-team': 'color_team',
        '/sb-plan': 'sb_plan',
        '/section-lm': 'section_lm',
        '/price-to-win': 'price_to_win',
      }

      let featureId: string | null = null
      for (const [route, id] of Object.entries(featureRoutes)) {
        if (path.startsWith(route)) { featureId = id; break }
      }
      if (!featureId) {
        for (const [suffix, id] of Object.entries(projectRoutes)) {
          if (path.endsWith(suffix)) { featureId = id; break }
        }
      }

      if (featureId) {
        setVisitedPages(prev => {
          const next = new Set(prev)
          next.add(featureId!)
          try { localStorage.setItem('procuvex_visited_features', JSON.stringify([...next])) } catch { /* noop */ }
          return next
        })
      }
    }

    trackVisit()
    window.addEventListener('popstate', trackVisit)
    return () => window.removeEventListener('popstate', trackVisit)
  }, [])

  if (!onboardingState.completed || dismissed) return null

  const undiscovered = DISCOVERY_ITEMS.filter(item => !visitedPages.has(item.id))
  if (undiscovered.length === 0) return null

  function handleDismiss() {
    setDismissed(true)
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* noop */ }
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-900">Discover More Features</span>
          <span className="text-xs text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded-full font-medium">{undiscovered.length} new</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleDismiss() }}
          className="text-indigo-400 hover:text-indigo-600 p-1"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <p className="text-xs text-indigo-600 mb-3">
            You&apos;ve completed setup. Here are advanced capabilities to explore:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {undiscovered.map(item => (
              <Link
                key={item.id}
                to={item.path}
                className="flex items-start gap-2 p-2.5 rounded-lg bg-white border border-indigo-100 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <item.icon size={16} className="text-indigo-500 mt-0.5 flex-shrink-0 group-hover:text-indigo-700" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 group-hover:text-indigo-900">{item.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{item.description}</p>
                  {item.projectScoped && (
                    <span className="text-[9px] text-indigo-500 font-medium mt-1 inline-block">Inside projects</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
