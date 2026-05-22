import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Rocket, Building, Users, FileStack, ClipboardList,
  Upload, Brain, Kanban, PartyPopper, ChevronRight,
  ChevronLeft, X, CheckCircle,
} from 'lucide-react'
import { ONBOARDING_STEPS, getOnboardingState, saveOnboardingState, markStepComplete } from '../lib/onboarding'

const STEP_ICONS = [Rocket, Building, Users, FileStack, ClipboardList, Upload, Brain, Kanban, PartyPopper]
const STEP_COLORS = [
  'from-blue-600 to-indigo-600',
  'from-purple-600 to-indigo-600',
  'from-green-600 to-teal-600',
  'from-indigo-600 to-blue-600',
  'from-cyan-600 to-blue-600',
  'from-orange-600 to-amber-600',
  'from-purple-600 to-pink-600',
  'from-teal-600 to-cyan-600',
  'from-green-600 to-emerald-600',
]

interface OnboardingGuideProps {
  onClose: () => void
}

export default function OnboardingGuide({ onClose }: OnboardingGuideProps) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const totalSteps = ONBOARDING_STEPS.length
  const currentStep = ONBOARDING_STEPS[step]
  const Icon = STEP_ICONS[step] || Rocket
  const gradient = STEP_COLORS[step] || STEP_COLORS[0]

  function handleNext() {
    markStepComplete(currentStep.id)
    if (step < totalSteps - 1) {
      setStep(step + 1)
    } else {
      handleFinish()
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1)
  }

  function handleGoToAction() {
    markStepComplete(currentStep.id)
    const state = getOnboardingState()
    state.started = true
    state.dismissedGuide = true
    state.currentStep = step + 1
    saveOnboardingState(state)
    onClose()
    navigate(currentStep.route)
  }

  function handleFinish() {
    markStepComplete(currentStep.id)
    const state = getOnboardingState()
    state.started = true
    state.completed = true
    state.dismissedGuide = true
    saveOnboardingState(state)
    onClose()
    navigate('/dashboard')
  }

  function handleSkip() {
    const state = getOnboardingState()
    state.started = true
    state.dismissedGuide = true
    saveOnboardingState(state)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header gradient */}
        <div className={`bg-gradient-to-r ${gradient} px-8 py-10 text-white relative`}>
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            title="Skip onboarding"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="bg-white/20 rounded-xl p-3">
              <Icon size={32} />
            </div>
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
                Step {step + 1} of {totalSteps}
              </p>
              <h2 className="text-xl font-bold">{currentStep.title}</h2>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5">
            {ONBOARDING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-all ${
                  i < step ? 'bg-white' : i === step ? 'bg-white/80' : 'bg-white/25'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            {currentStep.description}
          </p>

          {/* Quick tips for specific steps */}
          {step === 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">What Procuvex helps you do:</h4>
              <ul className="text-xs text-blue-800 space-y-1.5">
                <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 shrink-0" /> AI-powered document analysis for SOWs, RFPs, and bid packages</li>
                <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 shrink-0" /> Auto-generated compliance matrices and RFQ packages</li>
                <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 shrink-0" /> Pipeline management with workflow stages</li>
                <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 shrink-0" /> Subcontractor management and SOW bid tracking</li>
                <li className="flex items-start gap-2"><CheckCircle size={12} className="mt-0.5 text-blue-500 shrink-0" /> SAM.gov integration for federal opportunity search</li>
              </ul>
            </div>
          )}

          {step === 4 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-amber-900 mb-1">Supported project types:</h4>
              <p className="text-xs text-amber-800">Government Task Orders, Government RFPs, Construction Bids, IT Services, Commercial Procurement</p>
            </div>
          )}

          {step === 6 && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-purple-900 mb-1">AI generates for each project:</h4>
              <p className="text-xs text-purple-800">Compliance Matrix, RFQ Packages, Clarification Questions, Pricing & Risk Analysis, Executive Summary</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < totalSteps - 1 && step > 0 && (
              <button
                onClick={handleGoToAction}
                className="text-sm text-blue-600 hover:text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-50 font-medium"
              >
                {currentStep.action} →
              </button>
            )}
            <button
              onClick={step === totalSteps - 1 ? handleFinish : handleNext}
              className={`flex items-center gap-1.5 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
                step === totalSteps - 1
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {step === totalSteps - 1 ? (
                <>Finish Setup <PartyPopper size={14} /></>
              ) : step === 0 ? (
                <>Let's Go <ChevronRight size={14} /></>
              ) : (
                <>Next <ChevronRight size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
