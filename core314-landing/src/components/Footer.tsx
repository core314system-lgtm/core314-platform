import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-slate-50 border-t border-gray-200 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center space-y-6">
          <img src="/logo-icon.svg" alt="Core314" className="h-10 w-10" />
          
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/partners" className="text-slate-500 hover:text-sky-600 transition-colors">
              Partners
            </Link>
            <Link to="/privacy" className="text-slate-500 hover:text-sky-600 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-slate-500 hover:text-sky-600 transition-colors">
              Terms of Service
            </Link>
            <Link to="/ai-disclaimer" className="text-slate-500 hover:text-sky-600 transition-colors">
              AI Disclaimer
            </Link>
            <a href="mailto:support@core314.com" className="text-slate-500 hover:text-sky-600 transition-colors">
              Contact: support@core314.com
            </a>
          </nav>

                    <div className="text-center">
                      <p className="text-slate-400 text-sm">
                        © {currentYear} Core314™ Technologies LLC
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        United States
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Patent Pending
                      </p>
                    </div>
        </div>
      </div>
    </footer>
  );
}
