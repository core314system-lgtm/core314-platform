import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { services } from '../content/services';
import { CONSULT_PATH, track } from '../lib/site';

interface NavItem {
  to: string;
  label: string;
  dropdown?: { to: string; label: string }[];
}

const navLinks: NavItem[] = [
  {
    to: '/services',
    label: 'Services',
    dropdown: services.map((s) => ({ to: `/services/${s.slug}`, label: s.name })),
  },
  { to: '/industries', label: 'Industries' },
  { to: '/our-work', label: 'Our Work' },
  { to: '/how-we-work', label: 'How We Work' },
  { to: '/about', label: 'About' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const location = useLocation();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [mobileOpen]);

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const open = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDropdown(label);
  };
  const close = () => {
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  return (
    <header className={`fixed top-0 inset-x-0 z-50 bg-white transition-shadow ${scrolled ? 'shadow-sm border-b border-slate-200' : ''}`}>
      <nav aria-label="Main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Core314 Technologies home">
          <img src="/logo-icon.svg" alt="" className="h-8 w-8" width={32} height={32} />
          <span className="flex flex-col leading-none">
            <span className="text-lg font-bold text-slate-900">Core<span className="text-sky-700">314</span></span>
            <span className="text-[10px] tracking-[0.2em] text-slate-600 font-medium">TECHNOLOGIES</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((item) =>
            item.dropdown ? (
              <div key={item.to} className="relative" onMouseEnter={() => open(item.label)} onMouseLeave={close}>
                <Link
                  to={item.to}
                  aria-haspopup="true"
                  aria-expanded={openDropdown === item.label}
                  onFocus={() => open(item.label)}
                  className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md ${isActive(item.to) ? 'text-sky-700' : 'text-slate-700 hover:text-slate-900'}`}
                >
                  {item.label} <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Link>
                {openDropdown === item.label && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2">
                    {item.dropdown.map((d) => (
                      <Link key={d.to} to={d.to} onBlur={close} className="block px-4 py-2.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50">
                        {d.label}
                      </Link>
                    ))}
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <Link to={item.to} className="block px-4 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-50">
                        All services &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2 text-sm font-medium rounded-md ${isActive(item.to) ? 'text-sky-700' : 'text-slate-700 hover:text-slate-900'}`}
              >
                {item.label}
              </Link>
            ),
          )}
          <Link
            to={CONSULT_PATH}
            onClick={() => track('cta_click', { location: 'header', cta: 'schedule_consultation' })}
            className="ml-3 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            Schedule a Consultation
          </Link>
        </div>

        <button
          type="button"
          className="lg:hidden p-2 text-slate-700"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-x-0 top-16 bottom-0 bg-white overflow-y-auto border-t border-slate-200">
          <div className="px-4 py-6 space-y-1">
            {navLinks.map((item) => (
              <div key={item.to}>
                <Link to={item.to} className="block px-3 py-3 text-base font-semibold text-slate-900">
                  {item.label}
                </Link>
                {item.dropdown?.map((d) => (
                  <Link key={d.to} to={d.to} className="block pl-6 pr-3 py-2 text-sm text-slate-700">
                    {d.label}
                  </Link>
                ))}
              </div>
            ))}
            <Link
              to={CONSULT_PATH}
              onClick={() => track('cta_click', { location: 'mobile_menu', cta: 'schedule_consultation' })}
              className="block mt-4 px-4 py-3 text-center text-base font-semibold text-white bg-slate-900 rounded-lg"
            >
              Schedule a 20-Minute Consultation
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
