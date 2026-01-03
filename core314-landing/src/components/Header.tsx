import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8 md:h-9 md:w-9" />
          <span className="hidden sm:inline-block text-xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Core<span className="text-sky-500">314</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-5">
          <Link to="/product" className="text-slate-600 hover:text-sky-600 transition-colors font-medium">
            Product
          </Link>
          <Link to="/solutions" className="text-slate-600 hover:text-sky-600 transition-colors font-medium">
            Solutions
          </Link>
          <Link to="/integrations" className="text-slate-600 hover:text-sky-600 transition-colors font-medium">
            Integrations
          </Link>
          <Link to="/pricing" className="text-slate-600 hover:text-sky-600 transition-colors font-medium">
            Pricing
          </Link>
          <Link to="/contact" className="text-slate-600 hover:text-sky-600 transition-colors font-medium">
            Contact
          </Link>
          <Link to="/login" className="px-5 py-2 text-sky-600 hover:text-sky-700 transition-colors font-medium">
            Login
          </Link>
          <Link 
            to="/pricing" 
            className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-sm hover:shadow-md transition-all font-semibold"
          >
            Start Free Trial
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-slate-600 hover:text-sky-600 transition-colors"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation Panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white/98 backdrop-blur-md border-b border-gray-200 shadow-lg">
          <nav className="flex flex-col px-4 py-4 space-y-3">
            <Link 
              to="/product" 
              className="text-slate-600 hover:text-sky-600 transition-colors py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Product
            </Link>
            <Link 
              to="/solutions" 
              className="text-slate-600 hover:text-sky-600 transition-colors py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Solutions
            </Link>
            <Link 
              to="/integrations" 
              className="text-slate-600 hover:text-sky-600 transition-colors py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Integrations
            </Link>
            <Link 
              to="/pricing" 
              className="text-slate-600 hover:text-sky-600 transition-colors py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link 
              to="/contact" 
              className="text-slate-600 hover:text-sky-600 transition-colors py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <Link 
              to="/login" 
              className="text-sky-600 hover:text-sky-700 transition-colors py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
            <Link 
              to="/pricing" 
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-sm hover:shadow-md transition-all text-center font-semibold"
              onClick={() => setMobileMenuOpen(false)}
            >
              Start Free Trial
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
