import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const solutions = [
  {
    title: 'Intelligent Decision Support',
    problem: 'Decisions stall when information is scattered across systems, teams, and formats. Leaders are forced to act on incomplete data or wait for manual reports that arrive too late.',
    outcomes: ['Faster, better-informed decisions', 'Consolidated intelligence from multiple sources', 'Reduced analysis paralysis'],
    link: '/solutions/decision-support',
  },
  {
    title: 'Operational Visibility & Insight',
    problem: 'Leadership lacks real-time visibility into operational health across their organization. Critical issues go unnoticed until they become crises.',
    outcomes: ['Executive-level operational visibility', 'Early warning detection', 'Single source of operational truth'],
    link: '/solutions/operational-intelligence',
  },
  {
    title: 'Process & Compliance Automation',
    problem: 'Manual processes, compliance gaps, and workflow friction drain time and introduce risk. Teams spend hours on repetitive tasks that should be automated.',
    outcomes: ['Reduced operational friction', 'Built-in governance and compliance', 'Faster task execution'],
    link: '/solutions/process-automation',
  },
  {
    title: 'Custom Operational Systems',
    problem: 'Off-the-shelf software wasn\'t designed for how your organization actually operates. Configuration and workarounds only go so far.',
    outcomes: ['Systems that match your operations', 'Purpose-built architecture', 'No compromises on functionality'],
    link: '/solutions/custom-systems',
  },
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Technology Solutions
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            We build systems that solve the operational challenges most software ignores.
            Each solution area is driven by real operational needs — not theoretical use cases.
          </p>
        </div>
      </section>

      {/* Solutions Grid */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {solutions.map((solution) => (
              <Link
                key={solution.title}
                to={solution.link}
                className="group block p-8 rounded-xl border border-slate-200 hover:border-sky-200 hover:shadow-md transition-all"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h2 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-sky-600 transition-colors">
                      {solution.title}
                    </h2>
                    <p className="text-slate-600 leading-relaxed">{solution.problem}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Outcomes</p>
                    <ul className="space-y-2">
                      {solution.outcomes.map((outcome) => (
                        <li key={outcome} className="flex items-start gap-2 text-sm text-slate-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                          {outcome}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600">
                    Explore <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Looking for a Specific Solution?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Every organization has unique operational challenges. Let&apos;s discuss yours.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Talk to Our Team
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
