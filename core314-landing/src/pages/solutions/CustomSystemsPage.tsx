import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function CustomSystemsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/solutions" className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 mb-6">
            &larr; All Solutions
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Custom Operational Systems
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            When off-the-shelf software doesn&apos;t match how your organization actually
            operates — we design and build proprietary systems tailored to your requirements.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">The Problem</h2>
          <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
            <p>
              Every organization has processes, workflows, and operational requirements
              that are unique to how they operate. Generic software forces organizations
              to adapt their operations to fit the tool — creating workarounds, manual
              processes, and data gaps.
            </p>
            <p>
              Configuration only goes so far. At a certain level of operational complexity,
              the only solution is a system designed specifically for your environment.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">How We Solve It</h2>
          <div className="space-y-4 text-slate-600 text-lg leading-relaxed mb-10">
            <p>
              Core314 Technologies designs and builds proprietary operational systems
              using our proven platform technology and methodology. These are not
              configured templates — they are purpose-built platforms designed around
              how your organization actually functions.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              'Full-stack platform development',
              'Custom AI and intelligence layers',
              'Industry-specific UX and workflows',
              'Enterprise-grade security and compliance',
              'Integration with existing systems',
              'Ongoing operation and evolution',
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
              { title: 'Perfect Fit', desc: 'Systems designed around your operations, not the other way around.' },
              { title: 'No Compromises', desc: 'Every workflow, every requirement, built as specified.' },
              { title: 'Owned & Operated', desc: 'Core314 maintains and evolves the system alongside your business.' },
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
            Need a Custom System?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Let&apos;s discuss your operational requirements and explore whether a
            custom platform is the right solution.
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
