import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ProcuvexPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/products" className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 mb-6">
            &larr; All Products
          </Link>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-xl bg-sky-50 flex items-center justify-center">
              <span className="text-sky-600 font-bold text-xl">Px</span>
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
                Procuvex
              </h1>
              <p className="text-lg text-slate-500">AI-Powered Procurement Intelligence</p>
            </div>
          </div>
          <p className="text-lg text-slate-600 leading-relaxed max-w-3xl">
            Procuvex transforms government and enterprise procurement through intelligent
            automation. Built from direct experience in government contracting operations,
            it addresses the specific challenges procurement teams face every day.
          </p>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Built From Experience</h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Procuvex was created because existing procurement tools fail to address the
            complexity of government contracting — task order analysis, compliance
            requirements, bid/no-bid decisions, and subcontractor coordination. Rather
            than adapting generic software, we built a system designed specifically for
            how procurement teams actually operate.
          </p>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-10">Key Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Task Order Intelligence',
                desc: 'Automated analysis of task order requirements, deliverables, and compliance criteria.',
              },
              {
                title: 'Bid Decision Engine',
                desc: 'Data-driven bid/no-bid recommendations based on organizational capabilities and historical performance.',
              },
              {
                title: 'Compliance Matrix Generation',
                desc: 'Automated compliance mapping against solicitation requirements and regulatory frameworks.',
              },
              {
                title: 'Subcontractor Management',
                desc: 'Coordination, tracking, and evaluation of subcontractor relationships and performance.',
              },
              {
                title: 'Executive Summaries',
                desc: 'AI-generated executive briefs synthesizing opportunity analysis for leadership review.',
              },
              {
                title: 'Quote & Pricing Tools',
                desc: 'Intelligent pricing assistance incorporating historical data, rates, and competitive positioning.',
              },
            ].map((cap) => (
              <div key={cap.title} className="p-6 rounded-xl border border-slate-200 bg-white">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{cap.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who It Serves */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Who Procuvex Serves</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: 'Government Contractors',
                desc: 'Firms pursuing and managing government task orders, IDIQs, and BPAs.',
              },
              {
                title: 'Enterprise Procurement',
                desc: 'Large organizations managing complex, multi-vendor procurement operations.',
              },
              {
                title: 'Proposal Teams',
                desc: 'Teams preparing responses to government solicitations and RFPs.',
              },
              {
                title: 'Operations Leadership',
                desc: 'Executives who need visibility into procurement pipeline and performance.',
              },
            ].map((audience) => (
              <div key={audience.title} className="p-5 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-1">{audience.title}</h3>
                <p className="text-sm text-slate-600">{audience.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Explore Procuvex
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Learn more about how Procuvex can transform your procurement operations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://procuvex.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Visit procuvex.com <ExternalLink className="h-4 w-4" />
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium text-slate-700 border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
            >
              Contact Us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
