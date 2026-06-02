import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';

interface DropdownItem {
  to: string;
  label: string;
}

interface NavLink {
  to: string;
  label: string;
  dropdown?: DropdownItem[];
}

const navLinks: NavLink[] = [
  { to: '/about', label: 'About' },
  {
    to: '/solutions',
    label: 'Solutions',
    dropdown: [
      { to: '/solutions/decision-support', label: 'Intelligent Decision Support' },
      { to: '/solutions/operational-intelligence', label: 'Operational Visibility & Insight' },
      { to: '/solutions/process-automation', label: 'Process & Compliance Automation' },
      { to: '/solutions/custom-systems', label: 'Custom Operational Systems' },
    ],
  },
  {
    to: '/products',
    label: 'Products',
    dropdown: [
      { to: '/products/procuvex', label: 'Procuvex' },
    ],
  },
  { to: '/enterprise', label: 'Enterprise' },
  { to: '/industries', label: 'Industries' },
  { to: '/innovation', label: 'Innovation' },
];

function Dropdown({ items, isOpen, parentTo }: { items: DropdownItem[]; isOpen: boolean; parentTo: string }) {
  if (!isOpen) return null;
  return (
    <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="block px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          {item.label}
        </Link>
      ))}
      <div className="border-t border-slate-100 mt-1 pt-1">
        <Link
          to={parentTo}
          className="block px-4 py-2.5 text-sm font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 transition-colors"
        >
          View All &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const location = useLocation();
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  const handleMouseEnter = (label: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setOpenDropdown(label);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 150);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm'
          : 'bg-white/80 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                Core<span className="text-sky-600">314</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest -mt-0.5">
                Technologies
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <div
                key={link.to}
                className="relative"
                onMouseEnter={() => link.dropdown && handleMouseEnter(link.label)}
                onMouseLeave={() => link.dropdown && handleMouseLeave()}
              >
                <Link
                  to={link.to}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors inline-flex items-center gap-1 ${
                    location.pathname === link.to || location.pathname.startsWith(link.to + '/')
                      ? 'text-sky-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                  {link.dropdown && <ChevronDown className="h-3.5 w-3.5" />}
                </Link>
                {link.dropdown && (
                  <Dropdown
                    items={link.dropdown}
                    isOpen={openDropdown === link.label}
                    parentTo={link.to}
                  />
                )}
              </div>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/contact"
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Contact Us
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-slate-900/40 z-40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50 max-h-[80vh] overflow-y-auto">
            <nav className="flex flex-col px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <div key={link.to}>
                  <Link
                    to={link.to}
                    className={`px-3 py-2.5 text-sm font-medium rounded-md transition-colors block ${
                      location.pathname === link.to || location.pathname.startsWith(link.to + '/')
                        ? 'text-sky-600 bg-sky-50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                  {link.dropdown && (
                    <div className="ml-4 mt-1 mb-2 space-y-0.5">
                      {link.dropdown.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="block px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-md"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
                <Link
                  to="/contact"
                  className="block w-full py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg text-center"
                >
                  Contact Us
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
