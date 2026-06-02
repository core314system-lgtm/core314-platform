import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Our Product Portfolio
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Platforms designed, built, and operated by Core314 Technologies.
            Each product is born from direct operational experience in its target domain.
          </p>
        </div>
      </section>

      {/* Procuvex — Primary Product */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 lg:p-10 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-sky-50 flex items-center justify-center">
                <span className="text-sky-600 font-bold text-lg">Px</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Procuvex</h2>
                <p className="text-sm text-slate-500">AI-Powered Procurement Intelligence</p>
              </div>
            </div>
            <p className="text-lg text-slate-600 leading-relaxed mb-6">
              Procuvex transforms government and enterprise procurement through AI-driven
              task order analysis, bid intelligence, and compliance automation. Built from
              direct experience in government contracting operations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[
                'Task Order Intelligence',
                'Bid Decision Engine',
                'Compliance Matrix Generation',
                'Subcontractor Management',
                'Executive Summaries',
                'Quote & Pricing Tools',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/products/procuvex"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Learn More <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a
                href="https://procuvex.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
              >
                Visit procuvex.com <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Under Development */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
            Technology Under Development
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-3xl">
            Core314 Technologies develops multiple platforms addressing distinct operational
            domains. New platforms are announced at production readiness.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                area: 'Operational Intelligence',
                desc: 'Cross-system data fusion, executive-level business visibility, and operational health scoring.',
              },
              {
                area: 'Decision Support Systems',
                desc: 'Intelligent systems that consolidate information and enable faster, more confident decisions.',
              },
              {
                area: 'Data Intelligence Platforms',
                desc: 'Technology for resolving identities and relationships across fragmented data environments.',
              },
              {
                area: 'Workflow Automation Technologies',
                desc: 'Compliance-aware process automation for organizations with complex operational requirements.',
              },
            ].map((item) => (
              <div key={item.area} className="p-6 rounded-xl border border-slate-200 bg-white">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.area}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Need a Custom Platform?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Core314 Technologies also builds proprietary systems for organizations
            with specific operational requirements.
          </p>
          <Link
            to="/enterprise"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Explore Enterprise Solutions <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
