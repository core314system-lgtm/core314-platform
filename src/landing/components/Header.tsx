import { Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { Menu, X, ChevronDown, BookOpen, GitCompareArrows } from 'lucide-react'

const navLinks = [
  { to: '/product', label: 'Product' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/explore-network', label: 'Sub Network' },
  { to: '/solutions', label: 'Solutions' },
  { to: '/integrations-overview', label: 'Integrations' },
  { to: '/roi', label: 'Why Procuvex' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
]

const resourceLinks = {
  guides: [
    { to: '/guides/compliance-matrix', label: 'Compliance Matrix Guide', desc: 'Build winning compliance matrices for government RFPs' },
    { to: '/guides/government-proposals', label: 'Gov Proposal Checklist', desc: 'Step-by-step checklist for government proposals' },
    { to: '/guides/sam-gov', label: 'SAM.gov Guide', desc: 'Navigate SAM.gov registration and opportunities' },
  ],
  compare: [
    { to: '/compare/govwin', label: 'vs Deltek GovWin IQ', desc: 'Enterprise power at 1/10th the price' },
    { to: '/compare/spreadsheets', label: 'vs Spreadsheets', desc: 'Stop losing bids to copy-paste errors' },
    { to: '/compare/govly', label: 'vs Govly', desc: 'Find opportunities AND win them' },
  ],
}

export default function Header() {
  const [open, setOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false)
  const { pathname } = useLocation()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isResourcesActive = pathname.startsWith('/guides') || pathname.startsWith('/compare')

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setResourcesOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setResourcesOpen(false), 150)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            Procu<span className="text-blue-600">vex</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === link.to
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Resources Dropdown */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1 ${
                isResourcesActive
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              onClick={() => setResourcesOpen(!resourcesOpen)}
            >
              Resources
              <ChevronDown size={14} className={`transition-transform ${resourcesOpen ? 'rotate-180' : ''}`} />
            </button>

            {resourcesOpen && (
              <div className="absolute top-full right-0 mt-1 w-[520px] bg-white rounded-xl shadow-xl border border-slate-200 p-5 grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={16} className="text-blue-600" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Guides</span>
                  </div>
                  {resourceLinks.guides.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setResourcesOpen(false)}
                      className="block px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{link.label}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{link.desc}</p>
                    </Link>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <GitCompareArrows size={16} className="text-blue-600" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Compare</span>
                  </div>
                  {resourceLinks.compare.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setResourcesOpen(false)}
                      className="block px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{link.label}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{link.desc}</p>
                    </Link>
                  ))}
                  <Link
                    to="/compare"
                    onClick={() => setResourcesOpen(false)}
                    className="block px-3 py-2 mt-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    View all comparisons →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
          >
            Log In
          </Link>
          <Link
            to="/pricing"
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all"
          >
            Start Free Trial
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 pb-4">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2.5 text-sm font-medium rounded-lg ${
                pathname === link.to ? 'text-blue-600 bg-blue-50' : 'text-slate-600'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Mobile Resources Section */}
          <button
            onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg ${
              isResourcesActive ? 'text-blue-600 bg-blue-50' : 'text-slate-600'
            }`}
          >
            Resources
            <ChevronDown size={14} className={`transition-transform ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
          </button>
          {mobileResourcesOpen && (
            <div className="pl-4 border-l-2 border-blue-100 ml-3 mt-1 mb-2">
              <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Guides</p>
              {resourceLinks.guides.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => { setOpen(false); setMobileResourcesOpen(false) }}
                  className="block px-3 py-2 text-sm text-slate-600 hover:text-blue-600"
                >
                  {link.label}
                </Link>
              ))}
              <p className="px-3 py-1 mt-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Compare</p>
              {resourceLinks.compare.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => { setOpen(false); setMobileResourcesOpen(false) }}
                  className="block px-3 py-2 text-sm text-slate-600 hover:text-blue-600"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
            <Link to="/login" className="px-3 py-2.5 text-sm font-medium text-slate-700">
              Log In
            </Link>
            <Link
              to="/pricing"
              className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-center"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
