import { Link } from 'react-router-dom';

const footerLinks = {
  product: [
    { label: 'Product', to: '/product' },
    { label: 'How It Works', to: '/how-it-works' },
    { label: 'Integrations', to: '/integrations' },
    { label: 'Pricing', to: '/pricing' },
  ],
  solutions: [
    { label: 'Solutions', to: '/solutions' },
    { label: 'Partners', to: '/partners' },
    { label: 'Affiliate Program', to: '/affiliate' },
  ],
  company: [
    { label: 'Contact', to: '/contact' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms of Service', to: '/terms' },
    { label: 'AI Disclaimer', to: '/ai-disclaimer' },
  ],
};

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <img src="/logo-icon.svg" alt="Core314" className="h-8 w-8" />
              <span className="text-lg font-bold text-white tracking-tight">
                Core<span className="text-sky-400">314</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-4">
              Operational Intelligence Platform for Leadership Teams. Patent Pending.
            </p>
            <a
              href="mailto:support@core314.com"
              className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
            >
              support@core314.com
            </a>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
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
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            &copy; {currentYear} Core314&trade; Technologies LLC. All rights reserved. United States. Patent Pending.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link to="/cookies" className="hover:text-slate-300 transition-colors">
              Cookies
            </Link>
            <Link to="/dpa" className="hover:text-slate-300 transition-colors">
              DPA
            </Link>
          </div>
        </div>

        {/* Legal disclaimer */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-600 leading-relaxed text-center">
            Slack, HubSpot, QuickBooks, Google Calendar, Gmail, Jira, Trello, Microsoft Teams, Google Sheets, Asana, Salesforce, Zoom, GitHub, Zendesk, Notion, and Monday.com are trademarks of their respective owners. Core314 is not affiliated with or endorsed by these companies. Integration availability may vary and additional integrations are continuously being added.
          </p>
        </div>
      </div>
    </footer>
  );
}
