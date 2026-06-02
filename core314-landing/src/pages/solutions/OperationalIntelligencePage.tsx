import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function OperationalIntelligencePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/solutions" className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 mb-6">
            &larr; All Solutions
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Operational Visibility & Insight
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            When your operations span multiple systems and teams but leadership lacks a
            single source of truth — we build systems that deliver clarity.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">The Problem</h2>
          <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
            <p>
              Organizations operate across dozens of disconnected tools. Each team
              uses different systems. Data lives in silos. Leadership has no unified view
              of operational health — and critical issues go unnoticed until they escalate.
            </p>
            <p>
              Traditional dashboards require manual configuration and only show what you
              already know to look for. Real operational intelligence surfaces what you
              didn&apos;t know to ask about.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">How We Solve It</h2>
          <div className="space-y-4 text-slate-600 text-lg leading-relaxed mb-10">
            <p>
              Core314 Technologies builds systems that aggregate data from the tools your
              teams already use, detect meaningful patterns and anomalies, and deliver
              clear, actionable operational insight to leadership.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              'Cross-system data aggregation',
              'Operational health scoring',
              'Anomaly and signal detection',
              'Executive narrative generation',
              'Trend analysis and forecasting',
              'Real-time operational monitoring',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-4 bg-white rounded-lg border border-slate-200">
                <div className="h-2 w-2 rounded-full bg-sky-500 mt-2 flex-shrink-0" />
                <p className="text-slate-700 font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Outcomes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { title: 'Full Visibility', desc: 'See across your entire operation from a single source of truth.' },
              { title: 'Early Detection', desc: 'Identify issues before they become crises.' },
              { title: 'Operational Confidence', desc: 'Know the state of your organization at any moment.' },
            ].map((outcome) => (
              <div key={outcome.title} className="p-6 rounded-xl border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{outcome.title}</h3>
                <p className="text-sm text-slate-600">{outcome.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Need Operational Visibility?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Let&apos;s discuss how Core314 Technologies can build an operational intelligence
            system for your organization.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Discuss Your Requirements <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
