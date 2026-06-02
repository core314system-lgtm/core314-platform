import { Link } from 'react-router-dom';

const footerLinks = {
  solutions: [
    { label: 'Decision Support', to: '/solutions/decision-support' },
    { label: 'Operational Visibility', to: '/solutions/operational-intelligence' },
    { label: 'Process Automation', to: '/solutions/process-automation' },
    { label: 'Custom Systems', to: '/solutions/custom-systems' },
  ],
  products: [
    { label: 'All Products', to: '/products' },
    { label: 'Procuvex', to: '/products/procuvex' },
  ],
  company: [
    { label: 'About', to: '/about' },
    { label: 'Enterprise', to: '/enterprise' },
    { label: 'Industries', to: '/industries' },
    { label: 'Innovation', to: '/innovation' },
    { label: 'Partners', to: '/partners' },
    { label: 'Contact', to: '/contact' },
  ],
  legal: [
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms of Service', to: '/terms' },
    { label: 'AI Disclaimer', to: '/ai-disclaimer' },
    { label: 'Cookies', to: '/cookies' },
    { label: 'DPA', to: '/dpa' },
  ],
};

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-bold text-white tracking-tight">
                  Core<span className="text-sky-400">314</span>
                </span>
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest -mt-0.5">
                  Technologies
                </span>
              </div>
            </Link>
            <p className="text-sm leading-relaxed">
              Intelligent systems for complex operations.
            </p>
          </div>

          {/* Solutions */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Solutions
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.solutions.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Products
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.products.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            &copy; {currentYear} Core314&trade; Technologies LLC. All rights reserved. United States. Patent Pending.
          </p>
        </div>
      </div>
    </footer>
  );
}
