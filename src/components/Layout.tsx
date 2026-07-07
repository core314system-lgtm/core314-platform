import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Building,
  Building2,
  Shield,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Radar,
  Settings,
  CreditCard,
  User,
  Activity,
  MailPlus,
  Compass,
  HeartPulse,
  ChevronDown,
  Briefcase,
  ShieldCheck,
  FolderOpen,
  ScanSearch,
  Database,
  BadgeCheck,
  Bot,
  Mail,
  KeyRound,
  Handshake,
  Award,
  Truck,
  UserCheck,
  FileStack,
  TrendingUp,
  Calendar,
  Contact2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import GlobalChat from './GlobalChat'
import NotificationCenter from './NotificationCenter'
import OnboardingGuide from './OnboardingGuide'
import OnboardingChecklist from './OnboardingChecklist'
import DiscoveryPrompts from './DiscoveryPrompts'
import { getOnboardingState, saveOnboardingState, resetOnboarding, markStepComplete } from '../lib/onboarding'
import { useOrg } from '../contexts/OrgContext'
import { useTier } from '../hooks/useTier'

interface NavItem {
  path: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  enterpriseOnly?: boolean
  advanced?: boolean
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
    id: 'main',
    label: 'Main',
    icon: Briefcase,
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/projects', label: 'Projects', icon: ClipboardList },
      { path: '/opportunities', label: 'Opportunities', icon: Compass },
      { path: '/agent-hub', label: 'Agent Hub', icon: Bot, enterpriseOnly: true },
      { path: '/documents', label: 'Documents', icon: FolderOpen },
      { path: '/past-performance', label: 'Past Performance', icon: Award, advanced: true },
      { path: '/contract-vehicles', label: 'Contract Vehicles', icon: Truck, advanced: true },
      { path: '/contracts', label: 'Contracts', icon: FileStack },
      { path: '/labor-categories', label: 'Personnel & LCAT', icon: UserCheck, advanced: true },
      { path: '/competitive-intelligence', label: 'Market Intel', icon: TrendingUp, advanced: true },
      { path: '/cpars-tracker', label: 'CPARS Tracker', icon: Award, advanced: true },
      { path: '/contacts', label: 'Contacts', icon: Contact2, enterpriseOnly: true },
      { path: '/government-fiscal-calendar', label: 'Gov FY Calendar', icon: Calendar, advanced: true },
    ],
  },
  {
    id: 'network',
    label: 'Subcontractors',
    icon: Users,
    items: [
      { path: '/subcontractors', label: 'My Subcontractors', icon: Building2 },
      { path: '/find-subs', label: 'Find Subcontractors', icon: ScanSearch },
      { path: '/subcontractor-capture', label: 'Procuvex Capture', icon: Radar },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { path: '/settings', label: 'Organization', icon: Building },
      { path: '/settings/email-domain', label: 'Email Domain', icon: Mail },
      { path: '/settings/sso', label: 'SSO / SAML', icon: KeyRound },
      { path: '/settings/gate-templates', label: 'Gate Templates', icon: ShieldCheck },
      { path: '/billing', label: 'Billing', icon: CreditCard },
      { path: '/account', label: 'Account', icon: User },
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
      { path: '/admin/invites', label: 'Beta Invites', icon: MailPlus },
      { path: '/admin/partners', label: 'Partner Program', icon: Handshake },
      { path: '/admin/access', label: 'Global Admin', icon: Shield },
      { path: '/admin/system-health', label: 'System Health', icon: HeartPulse },
      { path: '/master-subs', label: 'Master Sub Database', icon: Database },
      { path: '/verification-review', label: 'Verification Review', icon: ShieldCheck },
      { path: '/ai-audit', label: 'AI Activity Log', icon: ScanSearch },
      { path: '/audit-log', label: 'Security Audit Log', icon: ClipboardList },
    ],
  },
]

// Map removed sidebar routes to their parent group so the correct group highlights
const ROUTE_GROUP_OVERRIDES: Record<string, string> = {
  '/pipeline': 'main',
  '/contracts': 'main',
  '/past-performance': 'main',
  '/contract-vehicles': 'main',
  '/labor-categories': 'main',
  '/compliance': 'main',
  '/comparison': 'main',
  '/analytics': 'main',
  '/intelligence': 'main',
  '/subcontractors': 'network',
  '/my-sub-profile': 'network',
  '/vendor-tracker': 'network',
  '/teaming': 'network',
  '/integrations': 'settings',
  '/feedback': 'settings',
}

function findActiveGroup(pathname: string): string {
  // Check overrides first for removed-from-sidebar routes
  for (const [route, groupId] of Object.entries(ROUTE_GROUP_OVERRIDES)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return groupId
    }
  }
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.path)) {
        return group.id
      }
    }
  }
  return 'main'
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, profile } = useAuth()
  const { currentOrg, isMultiTenantEnabled } = useOrg()
  const { isEnterprise, hasActiveSubscription, status: subStatus, trialDaysLeft } = useTier()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(() => {
    try { return localStorage.getItem('procuvex_show_advanced_nav') === 'true' } catch { return false }
  })

  const onboardingComplete = useMemo(() => {
    const state = getOnboardingState()
    return state.completed
  }, [location.pathname])

  // Detect subcontractor-only users (no org = just claimed, not an enterprise user)
  const isSubOnly = !currentOrg && !profile?.is_global_admin

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
          <Link to="/home" className="flex items-center gap-2">
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
          {/* Simplified nav for subcontractor-only users */}
          {isSubOnly ? (
            <div className="space-y-0.5">
              <Link
                to="/my-sub-profile"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/my-sub-profile'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <BadgeCheck size={16} />
                My Company Profile
              </Link>
              <Link
                to="/account"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/account'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <User size={16} />
                Account
              </Link>
              <Link
                to="/help"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/help'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <HelpCircle size={16} />
                Help Center
              </Link>
            </div>
          ) : navGroups
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
                      {group.items
                        .filter(item => !item.adminOnly || profile?.is_global_admin)
                        .filter(item => {
                          if (!item.advanced) return true
                          if (group.id !== 'main') return true
                          return showAdvanced || onboardingComplete
                        })
                        .map(item => {
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
                                : item.enterpriseOnly && !isEnterprise
                                  ? 'text-gray-400 hover:bg-gray-50 hover:text-gray-500'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <item.icon size={16} />
                            <span className="flex-1">{item.label}</span>
                            {item.enterpriseOnly && !isEnterprise && (
                              <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">ENT</span>
                            )}
                          </Link>
                        )
                      })}
                      {group.id === 'main' && !showAdvanced && !onboardingComplete && (
                        <button
                          onClick={() => {
                            setShowAdvanced(true)
                            try { localStorage.setItem('procuvex_show_advanced_nav', 'true') } catch { /* noop */ }
                          }}
                          className="flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors w-full"
                        >
                          <ChevronDown size={14} />
                          <span>Show more features</span>
                        </button>
                      )}
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
          <span className="font-semibold text-gray-900 text-sm flex-1">Procuvex</span>
          <NotificationCenter />
        </div>
        <div className="hidden lg:flex items-center justify-end px-6 py-2 bg-white border-b border-gray-200">
          <NotificationCenter />
        </div>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Subscription status banners */}
          {!profile?.is_global_admin && subStatus === 'cancelled' && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <AlertTriangle size={18} className="shrink-0" />
              <div className="flex-1">
                <span className="font-medium">Your subscription has been cancelled.</span>{' '}
                <span className="text-sm">Some features are restricted. Reactivate to restore full access.</span>
              </div>
              <Link to="/billing" className="text-sm font-medium text-red-700 hover:text-red-900 whitespace-nowrap">Reactivate →</Link>
            </div>
          )}
          {!profile?.is_global_admin && subStatus === 'past_due' && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <AlertTriangle size={18} className="shrink-0" />
              <div className="flex-1">
                <span className="font-medium">Payment past due.</span>{' '}
                <span className="text-sm">Please update your payment method to avoid service interruption.</span>
              </div>
              <Link to="/billing" className="text-sm font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap">Update Payment →</Link>
            </div>
          )}
          {!profile?.is_global_admin && subStatus === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 3 && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
              <Clock size={18} className="shrink-0" />
              <div className="flex-1">
                <span className="font-medium">Trial ending {trialDaysLeft === 0 ? 'today' : `in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}`}.</span>{' '}
                <span className="text-sm">Subscribe now to keep full access to all features.</span>
              </div>
              <Link to="/billing" className="text-sm font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap">Subscribe →</Link>
            </div>
          )}
          {!profile?.is_global_admin && !hasActiveSubscription && subStatus !== 'cancelled' && subStatus !== 'past_due' && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-800">
              <AlertTriangle size={18} className="shrink-0" />
              <div className="flex-1">
                <span className="font-medium">No active subscription.</span>{' '}
                <span className="text-sm">Subscribe to access all platform features.</span>
              </div>
              <Link to="/billing" className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap">View Plans →</Link>
            </div>
          )}
          {!isSubOnly && <OnboardingChecklist onLaunchGuide={handleLaunchGuide} />}
          {!isSubOnly && <DiscoveryPrompts />}
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
