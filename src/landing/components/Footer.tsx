import { Link } from 'react-router-dom'

const footerLinks = {
  product: [
    { label: 'Product', to: '/product' },
    { label: 'How It Works', to: '/how-it-works' },
    { label: 'Integrations', to: '/integrations-overview' },
    { label: 'Pricing', to: '/pricing' },
  ],
  solutions: [
    { label: 'Solutions', to: '/solutions' },
    { label: 'Government Contractors', to: '/solutions#government' },
    { label: 'Construction Firms', to: '/solutions#construction' },
    { label: 'IT Services', to: '/solutions#it-services' },
  ],
  resources: [
    { label: 'Compliance Matrix Guide', to: '/guides/compliance-matrix' },
    { label: 'Gov Proposal Checklist', to: '/guides/government-proposals' },
    { label: 'SAM.gov Guide', to: '/guides/sam-gov' },
    { label: 'Compare Procuvex', to: '/compare' },
  ],
  company: [
    { label: 'About Us', to: '/about' },
    { label: 'Contact', to: '/contact' },
    { label: 'Security', to: '/security' },
    { label: 'SLA', to: '/sla' },
    { label: 'System Status', to: '/status' },
    { label: 'Why Procuvex', to: '/roi' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms of Service', to: '/terms' },
  ],
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Procu<span className="text-blue-400">vex</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-4">
              AI-Powered Procurement Operating System. A product of Core314 Technologies LLC.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Product</h3>
            <ul className="space-y-2.5">
              {footerLinks.product.map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm hover:text-white transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Solutions</h3>
            <ul className="space-y-2.5">
              {footerLinks.solutions.map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm hover:text-white transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Resources</h3>
            <ul className="space-y-2.5">
              {footerLinks.resources.map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm hover:text-white transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-2.5">
              {footerLinks.company.map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm hover:text-white transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            &copy; {currentYear} Core314&trade; Technologies LLC. All rights reserved. United States.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link to="/cookies" className="hover:text-slate-300 transition-colors">Cookies</Link>
            <Link to="/dpa" className="hover:text-slate-300 transition-colors">DPA</Link>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-600 leading-relaxed text-center">
            Procuvex&trade; is a product of Core314 Technologies LLC. SAM.gov is a trademark of the U.S. General Services Administration.
            All other trademarks are the property of their respective owners. Procuvex is not affiliated with or endorsed by the U.S. government.
            AI-generated outputs are advisory only and do not constitute legal, financial, or professional advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
