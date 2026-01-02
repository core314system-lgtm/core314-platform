import { Link } from 'react-router-dom';
import { Linkedin, Twitter, Youtube } from 'lucide-react';

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

          <div className="flex gap-6">
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" 
               className="text-slate-400 hover:text-sky-600 transition-colors">
              <Linkedin className="h-5 w-5" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
               className="text-slate-400 hover:text-sky-600 transition-colors">
              <Twitter className="h-5 w-5" />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
               className="text-slate-400 hover:text-sky-600 transition-colors">
              <Youtube className="h-5 w-5" />
            </a>
          </div>

          <p className="text-slate-400 text-sm">
            © 2025 Core314. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
