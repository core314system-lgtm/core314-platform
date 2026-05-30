import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle, Circle, ChevronDown, ChevronUp,
  Rocket, X, RotateCcw, Sparkles,
} from 'lucide-react'
import {
  ONBOARDING_STEPS, getOnboardingState,
  markStepComplete, getCompletedCount,
} from '../lib/onboarding'

interface OnboardingChecklistProps {
  onLaunchGuide: () => void
}

export default function OnboardingChecklist({ onLaunchGuide }: OnboardingChecklistProps) {
  const [state, setState] = useState(getOnboardingState())
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('onboarding_checklist_expanded')
    return saved !== null ? saved === 'true' : true
  })
  const [dismissed, setDismissed] = useState(false)

  function handleToggleExpanded() {
    setExpanded(prev => {
      const next = !prev
      localStorage.setItem('onboarding_checklist_expanded', String(next))
      return next
    })
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setState(getOnboardingState())
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const completedCount = getCompletedCount()
  const totalSteps = ONBOARDING_STEPS.length
  const progress = Math.round((completedCount / totalSteps) * 100)
  const allDone = completedCount >= totalSteps

  if (dismissed || (!state.started && !state.dismissedGuide)) return null
  if (state.completed && allDone) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-green-600" />
            <span className="text-sm font-semibold text-green-800">Setup Complete!</span>
          </div>
          <button onClick={() => setDismissed(true)} className="text-green-400 hover:text-green-600">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-green-600 mt-1">You've completed all onboarding steps. Happy bidding!</p>
        <button
          onClick={() => {
            onLaunchGuide()
          }}
          className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 mt-2"
        >
          <RotateCcw size={10} /> Restart tour
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggleExpanded}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">Getting Started</span>
          <span className="text-xs text-gray-400">{completedCount}/{totalSteps}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {ONBOARDING_STEPS.map((step) => {
            const isComplete = state.stepsCompleted[step.id]
            return (
              <Link
                key={step.id}
                to={step.route}
                onClick={() => {
                  markStepComplete(step.id)
                  setState(getOnboardingState())
                }}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  isComplete
                    ? 'text-gray-400'
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {isComplete ? (
                  <CheckCircle size={14} className="text-green-500 shrink-0" />
                ) : (
                  <Circle size={14} className="text-gray-300 shrink-0" />
                )}
                <span className={isComplete ? 'line-through' : ''}>{step.title}</span>
              </Link>
            )
          })}
          <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
            <button
              onClick={onLaunchGuide}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Relaunch guided tour
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
