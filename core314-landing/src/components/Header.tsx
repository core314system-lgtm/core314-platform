import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { to: '/product', label: 'Product' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/solutions', label: 'Solutions' },
  { to: '/integrations', label: 'Integrations' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

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
  }, [location.pathname]);

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
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              Core<span className="text-sky-600">314</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  location.pathname === link.to
                    ? 'text-sky-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Start Free Trial
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
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50">
            <nav className="flex flex-col px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    location.pathname === link.to
                      ? 'text-sky-600 bg-sky-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
                <Link
                  to="/login"
                  className="block px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-md"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="block w-full py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg text-center"
                >
                  Start Free Trial
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
