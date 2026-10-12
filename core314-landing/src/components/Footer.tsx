import { Link } from 'react-router-dom';
import { services } from '../content/services';

const company = [
  { label: 'Industries', to: '/industries' },
  { label: 'Our Work', to: '/our-work' },
  { label: 'How We Work', to: '/how-we-work' },
  { label: 'About', to: '/about' },
  { label: 'Schedule a Consultation', to: '/contact' },
];
const legal = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Service', to: '/terms' },
  { label: 'AI Disclaimer', to: '/ai-disclaimer' },
  { label: 'Cookies', to: '/cookies' },
  { label: 'DPA', to: '/dpa' },
];

function Col({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold tracking-wider text-slate-300 uppercase mb-4">{title}</h2>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-slate-300 hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2.5 mb-4" aria-label="Core314 Technologies home">
            <img src="/logo-icon.svg" alt="" className="h-8 w-8" width={32} height={32} />
            <span className="text-lg font-bold text-white">Core<span className="text-sky-400">314</span> Technologies</span>
          </Link>
          <p className="text-sm leading-relaxed">Custom software and workflow automation, designed around how your business operates.</p>
        </div>
        <Col title="Services" links={services.map((s) => ({ label: s.name, to: `/services/${s.slug}` }))} />
        <Col title="Company" links={company} />
        <Col title="Legal" links={legal} />
      </div>
      <div className="border-t border-slate-800">
        <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Core314&trade; Technologies LLC. All rights reserved. ProCuvex is a product of Core314 Technologies.
        </p>
      </div>
    </footer>
  );
}
