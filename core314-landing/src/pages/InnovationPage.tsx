import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function InnovationPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Innovation at Core314 Technologies
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Our research and development is driven by real operational problems — not
            trends. We invest in technology that makes measurable differences in how
            organizations operate.
          </p>
        </div>
      </section>

      {/* Problems We're Solving */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Problems We Are Solving
          </h2>
          <p className="text-lg text-slate-600 mb-10 max-w-3xl">
            Every research initiative at Core314 Technologies begins with a real
            operational problem that organizations face today.
          </p>
          <div className="space-y-6">
            {[
              {
                problem: 'Operational Visibility Gaps',
                detail: 'Organizations operate across dozens of disconnected systems. Leadership has no unified view of operational health. Critical issues go unnoticed until they become crises.',
                approach: 'Cross-system data aggregation, intelligent signal detection, and executive-level insight delivery.',
              },
              {
                problem: 'Fragmented Data Environments',
                detail: 'The same customer, project, or entity exists across multiple systems under different names, IDs, and formats. No single source of truth.',
                approach: 'Cross-system identity resolution, entity matching, and unified data intelligence layers.',
              },
              {
                problem: 'Decision Latency',
                detail: 'Decisions that should take minutes take days because the right information isn\'t consolidated, prioritized, or accessible when needed.',
                approach: 'Intelligent consolidation, scoring engines, and context-aware information delivery.',
              },
              {
                problem: 'Compliance Complexity',
                detail: 'Regulatory and contractual compliance managed through spreadsheets and manual audits. Gaps are inevitable. Non-compliance is a matter of when, not if.',
                approach: 'Compliance-aware system architecture with automated monitoring, audit trails, and policy enforcement.',
              },
              {
                problem: 'Workflow Inefficiencies',
                detail: 'Expert time consumed by repetitive manual processes — data entry, document handling, approvals, and reporting — that should be automated.',
                approach: 'Intelligent process automation with context awareness, exception handling, and compliance enforcement.',
              },
            ].map((item) => (
              <div key={item.problem} className="p-6 rounded-xl border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.problem}</h3>
                <p className="text-slate-600 leading-relaxed mb-3">{item.detail}</p>
                <p className="text-sm text-slate-500">
                  <span className="font-medium text-slate-700">Our approach:</span> {item.approach}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intellectual Property */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
            Intellectual Property
          </h2>
          <div className="p-6 rounded-xl border border-slate-200 bg-white">
            <p className="text-lg text-slate-600 leading-relaxed">
              Core314 Technologies holds patent-pending technology in operational intelligence
              methodology — specifically, how fragmented operational data from multiple systems
              is consolidated, scored for significance, correlated across platforms, and
              presented as actionable executive insight. This proprietary approach forms the
              foundation of our platform architecture.
            </p>
          </div>
        </div>
      </section>

      {/* Development Philosophy */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
            Development Philosophy
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: 'In-House Engineering',
                desc: 'All design, development, and operations are internal. No outsourced development. Full accountability.',
              },
              {
                title: 'Production-Grade From Day One',
                desc: 'Systems are built to operate in real environments from the first release. No prototypes disguised as products.',
              },
              {
                title: 'Security as Architecture',
                desc: 'Security and compliance are structural decisions, not features added after the fact.',
              },
              {
                title: 'Independent Platforms',
                desc: 'Every product is designed to operate independently and scale on its own — decoupled from other systems.',
              },
              {
                title: 'Long-Term Technology Investment',
                desc: 'We invest in technology assets with compounding value. Not short-term solutions that need replacement.',
              },
              {
                title: 'Problem-Driven Development',
                desc: 'Every feature, every system, every line of code starts with a real business problem that organizations need solved.',
              },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Interested in Our Technology?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Whether you&apos;re exploring our products or considering an enterprise
            engagement, we&apos;d welcome the conversation.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Contact Us <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
