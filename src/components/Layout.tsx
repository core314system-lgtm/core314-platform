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
  User,
  Activity,
  MailPlus,
  MessageSquare,
  Compass,
  HeartPulse,
  ChevronDown,
  Briefcase,
  Network,
  BarChart2,
  Wrench,
  ShieldCheck,
  FolderOpen,
  ScanSearch,
  Database,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import GlobalChat from './GlobalChat'
import OnboardingGuide from './OnboardingGuide'
import OnboardingChecklist from './OnboardingChecklist'
import { getOnboardingState, saveOnboardingState, resetOnboarding, markStepComplete } from '../lib/onboarding'
import { useOrg } from '../contexts/OrgContext'

interface NavItem {
  path: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
}

interface NavGroup {
  id: string
  label: string
  icon: React.ElementType
  items: NavItem[]
  adminOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    id: 'work',
    label: 'Work',
    icon: Briefcase,
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/opportunities', label: 'Opportunity Feed', icon: Compass },
      { path: '/projects', label: 'Projects', icon: ClipboardList },
      { path: '/pipeline', label: 'Pipeline', icon: Kanban },
      { path: '/contracts', label: 'Contracts', icon: FileStack },
      { path: '/documents', label: 'Document Library', icon: FolderOpen },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    icon: Network,
    items: [
      { path: '/subcontractors', label: 'Subcontractors', icon: Users },
      { path: '/master-subs', label: 'Master Sub Database', icon: Database },
      { path: '/subcontractor-capture', label: 'Procuvex Capture', icon: Radar },
      { path: '/vendor-tracker', label: 'Vendor Intelligence', icon: Building },
      { path: '/teaming', label: 'Teaming & JVs', icon: Users },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: BarChart2,
    items: [
      { path: '/compliance', label: 'Compliance Matrices', icon: Shield },
      { path: '/comparison', label: 'Compare Projects', icon: GitCompareArrows },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/intelligence', label: 'Intelligence Library', icon: Brain },
    ],
  },
  {
    id: 'ai_compliance',
    label: 'AI Compliance',
    icon: ShieldCheck,
    items: [
      { path: '/ai-audit', label: 'AI Activity Log', icon: ScanSearch },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    items: [
      { path: '/integrations', label: 'Integrations', icon: Plug },
      { path: '/billing', label: 'Billing', icon: CreditCard },
      { path: '/settings', label: 'Organization', icon: Settings },
      { path: '/account', label: 'Account', icon: User },
      { path: '/feedback', label: 'Partner Feedback', icon: MessageSquare },
      { path: '/help', label: 'Help Center', icon: HelpCircle },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { path: '/admin/analytics', label: 'Beta Analytics', icon: Activity },
      { path: '/admin/invites', label: 'Partner Program', icon: MailPlus },
      { path: '/admin/access', label: 'Global Admin', icon: Shield },
      { path: '/admin/system-health', label: 'System Health', icon: HeartPulse },
    ],
  },
]

function findActiveGroup(pathname: string): string {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.path)) {
        return group.id
      }
    }
  }
  return 'work'
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, profile } = useAuth()
  const { currentOrg, isMultiTenantEnabled } = useOrg()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const activeGroupId = useMemo(() => findActiveGroup(location.pathname), [location.pathname])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set([activeGroupId]))

  // Auto-expand the group containing the active page
  useEffect(() => {
    setExpandedGroups(prev => {
      if (prev.has(activeGroupId)) return prev
      const next = new Set(prev)
      next.add(activeGroupId)
      return next
    })
  }, [activeGroupId])

  function toggleGroup(groupId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

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

        <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto min-h-0">
          {navGroups
            .filter(group => !group.adminOnly || profile?.is_global_admin)
            .map(group => {
              const isExpanded = expandedGroups.has(group.id)
              const hasActiveItem = group.items.some(item =>
                item.path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(item.path)
              )
              const GroupIcon = group.icon

              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                      hasActiveItem
                        ? 'text-blue-700 bg-blue-50/50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon size={14} />
                      {group.label}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="mt-0.5 mb-1 space-y-0.5">
                      {group.items.map(item => {
                        const isActive = item.path === '/dashboard'
                          ? location.pathname === '/dashboard'
                          : location.pathname.startsWith(item.path)
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <item.icon size={16} />
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
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
