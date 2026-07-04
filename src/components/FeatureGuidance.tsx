import { useState } from 'react'
import { Lightbulb, X, ChevronDown, ChevronUp } from 'lucide-react'

interface GuidanceStep {
  title: string
  description: string
}

interface FeatureGuidanceProps {
  title: string
  description: string
  steps: GuidanceStep[]
  storageKey: string
  accentColor?: string
}

export default function FeatureGuidance({ title, description, steps, storageKey, accentColor = 'blue' }: FeatureGuidanceProps) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(`guidance_${storageKey}`) === 'dismissed' } catch { return false }
  })
  const [expanded, setExpanded] = useState(true)

  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    try { localStorage.setItem(`guidance_${storageKey}`, 'dismissed') } catch { /* noop */ }
  }

  const colors: Record<string, { bg: string; border: string; iconBg: string; text: string; title: string; step: string; stepBorder: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', text: 'text-blue-700', title: 'text-blue-900', step: 'bg-blue-100/50', stepBorder: 'border-blue-200' },
    green: { bg: 'bg-green-50', border: 'border-green-200', iconBg: 'bg-green-100', text: 'text-green-700', title: 'text-green-900', step: 'bg-green-100/50', stepBorder: 'border-green-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', iconBg: 'bg-purple-100', text: 'text-purple-700', title: 'text-purple-900', step: 'bg-purple-100/50', stepBorder: 'border-purple-200' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', text: 'text-amber-700', title: 'text-amber-900', step: 'bg-amber-100/50', stepBorder: 'border-amber-200' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', iconBg: 'bg-pink-100', text: 'text-pink-700', title: 'text-pink-900', step: 'bg-pink-100/50', stepBorder: 'border-pink-200' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', iconBg: 'bg-indigo-100', text: 'text-indigo-700', title: 'text-indigo-900', step: 'bg-indigo-100/50', stepBorder: 'border-indigo-200' },
  }

  const c = colors[accentColor] || colors.blue

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 mb-6`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className={`${c.iconBg} p-1.5 rounded-lg flex-shrink-0 mt-0.5`}>
            <Lightbulb size={16} className={c.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-semibold ${c.title}`}>{title}</h3>
              <button
                onClick={() => setExpanded(!expanded)}
                className={`p-0.5 rounded hover:bg-white/50 ${c.text}`}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            <p className={`text-xs ${c.text} mt-0.5`}>{description}</p>

            {expanded && steps.length > 0 && (
              <div className="mt-3 space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className={`flex items-start gap-2.5 ${c.step} rounded-lg p-2.5 border ${c.stepBorder}`}>
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full ${c.iconBg} flex items-center justify-center text-[10px] font-bold ${c.text}`}>
                      {i + 1}
                    </span>
                    <div>
                      <span className={`text-xs font-semibold ${c.title}`}>{step.title}</span>
                      <p className={`text-xs ${c.text} mt-0.5`}>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className={`p-1 rounded-lg hover:bg-white/50 flex-shrink-0 ml-2 ${c.text}`}
          title="Dismiss guide"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
