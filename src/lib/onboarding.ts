/**
 * Onboarding state management via localStorage
 */

export interface OnboardingStep {
  id: string
  title: string
  description: string
  action: string
  route: string
  checkKey: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Procuvex',
    description: 'Your AI-powered procurement intelligence platform. Let\'s get you set up in a few simple steps.',
    action: 'Get Started',
    route: '/dashboard',
    checkKey: 'onboarding_welcome',
  },
  {
    id: 'org_setup',
    title: 'Set Up Your Organization',
    description: 'Configure your organization name, invite team members, and set up roles. This is your shared workspace where all projects and data live.',
    action: 'Go to Organization Settings',
    route: '/settings',
    checkKey: 'onboarding_org_setup',
  },
  {
    id: 'add_subs',
    title: 'Add Your Subcontractors',
    description: 'Build your subcontractor database — add vendors manually or import from CSV. These will be available to assign across all your projects.',
    action: 'Go to Subcontractors',
    route: '/subcontractors',
    checkKey: 'onboarding_add_subs',
  },
  {
    id: 'create_contract',
    title: 'Create a Contract (Optional)',
    description: 'If you work under IDIQ, BPA, GSA Schedule, or other contract vehicles, create a parent contract first. Task orders and projects can then be grouped under it.',
    action: 'Go to Contracts',
    route: '/contracts',
    checkKey: 'onboarding_create_contract',
  },
  {
    id: 'create_project',
    title: 'Create Your First Project',
    description: 'Start a new task order, RFP, or bid. Enter the basics — title, type, location, deadline — and optionally link it to a parent contract.',
    action: 'Create New Project',
    route: '/projects/new',
    checkKey: 'onboarding_create_project',
  },
  {
    id: 'upload_docs',
    title: 'Upload Project Documents',
    description: 'Upload your SOW, pricing sheets, exhibits, amendments, and any other bid documents. These are what the AI will analyze.',
    action: 'Open a Project',
    route: '/projects',
    checkKey: 'onboarding_upload_docs',
  },
  {
    id: 'run_analysis',
    title: 'Run AI Analysis',
    description: 'Click "Run AI Analysis" on any project to extract requirements, identify risks, generate compliance matrices, RFQ packages, and executive summaries.',
    action: 'Open a Project',
    route: '/projects',
    checkKey: 'onboarding_run_analysis',
  },
  {
    id: 'explore_pipeline',
    title: 'Explore Your Pipeline',
    description: 'The Pipeline view shows all your projects on a kanban board organized by workflow stage. Drag cards or click stage buttons to advance projects through your process.',
    action: 'View Pipeline',
    route: '/pipeline',
    checkKey: 'onboarding_explore_pipeline',
  },
  {
    id: 'explore_more',
    title: 'You\'re All Set!',
    description: 'You\'ve completed the basics! Use the Procuvex Intelligence chatbot (bottom-right) for any questions — it knows your account data and can help with anything. Explore Analytics, Integrations, and Billing to manage your subscription.',
    action: 'Go to Dashboard',
    route: '/dashboard',
    checkKey: 'onboarding_complete',
  },
]

const STORAGE_KEY = 'procuvex_onboarding'

export interface OnboardingState {
  started: boolean
  completed: boolean
  dismissedGuide: boolean
  currentStep: number
  stepsCompleted: Record<string, boolean>
}

function getDefaultState(): OnboardingState {
  return {
    started: false,
    completed: false,
    dismissedGuide: false,
    currentStep: 0,
    stepsCompleted: {},
  }
}

export function getOnboardingState(): OnboardingState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return getDefaultState()
}

export function saveOnboardingState(state: OnboardingState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function markStepComplete(stepId: string) {
  const state = getOnboardingState()
  state.stepsCompleted[stepId] = true
  const completedCount = ONBOARDING_STEPS.filter(s => state.stepsCompleted[s.id]).length
  if (completedCount >= ONBOARDING_STEPS.length) {
    state.completed = true
  }
  saveOnboardingState(state)
  return state
}

export function getCompletedCount(): number {
  const state = getOnboardingState()
  return ONBOARDING_STEPS.filter(s => state.stepsCompleted[s.id]).length
}

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
}
