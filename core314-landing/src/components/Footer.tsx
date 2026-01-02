import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-gray-200 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center space-y-6">
          <img src="/logo-icon.png" alt="Core314" className="h-12 w-12" />
          
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/privacy" className="text-slate-500 hover:text-sky-600 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-slate-500 hover:text-sky-600 transition-colors">
              Terms of Service
            </Link>
            <Link to="/cookies" className="text-slate-500 hover:text-sky-600 transition-colors">
              Cookie Policy
            </Link>
            <Link to="/dpa" className="text-slate-500 hover:text-sky-600 transition-colors">
              Data Processing Addendum
            </Link>
          </nav>

          <p className="text-slate-400 text-sm">
            © 2025 Core314. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
