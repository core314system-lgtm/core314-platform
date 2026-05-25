import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Building,
  Shield,
  GitCompareArrows,
  Brain,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Radar,
  Settings,
  Kanban,
  Plug,
  BarChart3,
  FileStack,
  CreditCard,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import GlobalChat from './GlobalChat'
import OnboardingGuide from './OnboardingGuide'
import OnboardingChecklist from './OnboardingChecklist'
import { getOnboardingState, saveOnboardingState, resetOnboarding, markStepComplete } from '../lib/onboarding'
import { useOrg } from '../contexts/OrgContext'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/contracts', label: 'Contracts', icon: FileStack },
  { path: '/projects', label: 'Projects', icon: ClipboardList },
  { path: '/pipeline', label: 'Pipeline', icon: Kanban },
  { path: '/subcontractors', label: 'Subcontractors', icon: Users },
  { path: '/subcontractor-capture', label: 'Procuvex Capture', icon: Radar },
  { path: '/vendor-tracker', label: 'Vendor Intelligence', icon: Building },
  { path: '/teaming', label: 'Teaming & JVs', icon: Users },
  { path: '/compliance', label: 'Compliance Matrices', icon: Shield },
  { path: '/comparison', label: 'Compare Projects', icon: GitCompareArrows },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/intelligence', label: 'Intelligence Library', icon: Brain },
  { path: '/billing', label: 'Billing', icon: CreditCard },
  { path: '/settings', label: 'Organization', icon: Settings },
  { path: '/help', label: 'Help Center', icon: HelpCircle },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, profile } = useAuth()
  const { currentOrg, isMultiTenantEnabled } = useOrg()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    const state = getOnboardingState()
    if (!state.started && !state.dismissedGuide) {
      setShowGuide(true)
      const s = getOnboardingState()
      s.started = true
      saveOnboardingState(s)
    }
  }, [])

  function handleLaunchGuide() {
    resetOnboarding()
    const s = getOnboardingState()
    s.started = true
    saveOnboardingState(s)
    setShowGuide(true)
  }

  // Auto-mark onboarding steps complete based on page visits
  useEffect(() => {
    const path = location.pathname
    const routeToStep: Record<string, string> = {
      '/settings': 'org_setup',
      '/subcontractors': 'add_subs',
      '/contracts': 'create_contract',
      '/projects/new': 'create_project',
      '/pipeline': 'explore_pipeline',
    }
    // Mark step for current route
    for (const [route, stepId] of Object.entries(routeToStep)) {
      if (path === route || path.startsWith(route + '/')) {
        markStepComplete(stepId)
      }
    }
    // Mark upload & analysis steps if on a project detail page
    if (/^\/projects\/[^/]+$/.test(path)) {
      markStepComplete('upload_docs')
      markStepComplete('run_analysis')
    }
  }, [location.pathname])

  // Hide global chat on project detail pages (they have their own project-specific chat)
  const isTaskOrderDetailPage = /^\/projects\/[^/]+$/.test(location.pathname)

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:relative lg:translate-x-0 flex flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="bg-blue-600 text-white rounded-lg w-8 h-8 flex items-center justify-center font-bold text-sm">Px</div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm leading-tight">Procuvex</h1>
              <p className="text-xs text-gray-400">A product of Core314 Technologies LLC</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto min-h-0">
          {navItems.map(item => {
            const isActive = item.path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 p-4 border-t border-gray-200">
          {isMultiTenantEnabled && currentOrg && (
            <Link to="/settings" className="block mb-3 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
              <p className="text-xs font-medium text-gray-700 truncate">{currentOrg.name}</p>
              <p className="text-[10px] text-gray-400">Organization</p>
            </Link>
          )}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 truncate max-w-[160px]">
              {profile?.full_name || profile?.email || 'User'}
              <br />
              <span className="text-gray-400 capitalize">{profile?.role?.replace('_', ' ') || ''}</span>
            </div>
            <button onClick={signOut} className="text-gray-400 hover:text-red-500 p-1" title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-gray-900 text-sm">Procuvex</span>
        </div>
        <div className="p-6 max-w-7xl mx-auto">
          <OnboardingChecklist onLaunchGuide={handleLaunchGuide} />
          {children}
        </div>
      </main>

      {/* Global Procuvex Intelligence chat — hidden on task order detail pages which have their own chat */}
      {!isTaskOrderDetailPage && <GlobalChat />}

      {/* Onboarding guide modal */}
      {showGuide && <OnboardingGuide onClose={() => setShowGuide(false)} />}
    </div>
  )
}
