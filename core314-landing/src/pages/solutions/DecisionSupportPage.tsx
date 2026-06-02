import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function DecisionSupportPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/solutions" className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 mb-6">
            &larr; All Solutions
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Intelligent Decision Support
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            When decisions depend on data scattered across systems, teams, and formats — we
            build systems that bring clarity and enable confident, timely action.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">The Problem</h2>
          <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
            <p>
              Modern organizations generate data across dozens of systems — CRMs, project
              management tools, financial platforms, communication channels, and operational
              databases. Decision-makers need to synthesize information from all of these
              to act effectively.
            </p>
            <p>
              Without intelligent systems to consolidate and surface the right information
              at the right time, leaders either make decisions with incomplete data or
              wait for manual reports that arrive too late to be actionable.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">How We Solve It</h2>
          <div className="space-y-4 text-slate-600 text-lg leading-relaxed mb-10">
            <p>
              Core314 Technologies builds intelligent systems that consolidate data across
              platforms, detect meaningful patterns, and deliver actionable insight —
              designed around how your organization actually makes decisions.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              'Multi-source data consolidation',
              'Pattern detection and anomaly identification',
              'Scoring and prioritization engines',
              'Executive-level insight delivery',
              'Real-time data processing',
              'Configurable decision frameworks',
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
              { title: 'Better Decisions', desc: 'Act on consolidated intelligence, not fragmented data.' },
              { title: 'Faster Response', desc: 'Reduce decision latency from days to minutes.' },
              { title: 'Confidence', desc: 'Know that decisions are informed by complete, current information.' },
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
            Need an Intelligent Decision System?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Let&apos;s discuss how Core314 Technologies can build a decision support
            system designed for your operational environment.
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
