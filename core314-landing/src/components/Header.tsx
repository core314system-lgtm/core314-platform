import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0F1A]/80 backdrop-blur-md border-b border-[#00BFFF]/20">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo-icon.png" alt="Core314" className="h-8 w-8 md:h-10 md:w-10" />
          <span className="hidden sm:inline-block text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>Core314</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/pricing" className="text-gray-300 hover:text-[#00BFFF] transition-colors">
            Pricing
          </Link>
          <Link to="/contact" className="text-gray-300 hover:text-[#00BFFF] transition-colors">
            Contact
          </Link>
          <Link to="/login" className="px-6 py-2 text-[#00BFFF] hover:text-[#66FCF1] transition-colors">
            Login
          </Link>
          <Link 
            to="/pricing" 
            className="px-6 py-2 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg hover:shadow-[0_0_20px_rgba(0,191,255,0.5)] transition-all"
          >
            Start Free Trial
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#00BFFF] hover:text-[#66FCF1] transition-colors"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#0A0F1A]/95 backdrop-blur-md border-b border-[#00BFFF]/20">
          <nav className="flex flex-col px-4 py-4 space-y-4">
            <Link 
              to="/pricing" 
              className="text-gray-300 hover:text-[#00BFFF] transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link 
              to="/contact" 
              className="text-gray-300 hover:text-[#00BFFF] transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <Link 
              to="/login" 
              className="text-[#00BFFF] hover:text-[#66FCF1] transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
            <Link 
              to="/pricing" 
              className="w-full py-3 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg hover:shadow-[0_0_20px_rgba(0,191,255,0.5)] transition-all text-center"
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
