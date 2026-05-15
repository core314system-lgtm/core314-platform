import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Building,
  Shield,
  GitCompareArrows,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/task-orders', label: 'Incoming RFQs', icon: ClipboardList },
  { path: '/subcontractors', label: 'Subcontractors', icon: Users },
  { path: '/vendor-tracker', label: 'Vendor Intelligence', icon: Building },
  { path: '/compliance', label: 'Compliance Matrices', icon: Shield },
  { path: '/comparison', label: 'Compare Task Orders', icon: GitCompareArrows },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, profile } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:relative lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 text-white rounded-lg w-8 h-8 flex items-center justify-center font-bold text-sm">TI</div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm leading-tight">Task Order Intelligence</h1>
              <p className="text-xs text-gray-400">Core314 Technologies LLC</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map(item => {
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
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

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
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
          <span className="font-semibold text-gray-900 text-sm">Task Order Intelligence</span>
        </div>
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
