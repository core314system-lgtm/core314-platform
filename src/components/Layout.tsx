import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/task-orders', label: 'Task Orders', icon: FileText },
  { path: '/subcontractors', label: 'Subcontractors', icon: Users },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-gray-600"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Link to="/" className="font-bold text-gray-900 text-lg">
              Task Order Intelligence
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">
              {profile?.full_name || profile?.email}
            </span>
            <button
              onClick={signOut}
              className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${mobileOpen ? 'block' : 'hidden'} md:block w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-3.5rem)] fixed md:sticky top-14 z-20`}>
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map(item => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
