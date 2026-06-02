import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Enterprise Technology Solutions
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            For organizations whose operational complexity exceeds what off-the-shelf
            software can address, Core314 Technologies designs and builds proprietary
            systems using our proven technology and operational methodology.
          </p>
        </div>
      </section>

      {/* What We Build */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Systems We Build
          </h2>
          <p className="text-lg text-slate-600 mb-10 max-w-3xl">
            We don&apos;t build generic software. We design operational systems for
            organizations with real complexity.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Operational Command Centers',
                desc: 'Centralized operational visibility with real-time status, alerts, and coordination across departments.',
              },
              {
                title: 'Executive Dashboards & Reporting',
                desc: 'Leadership-level insight platforms with automated narrative generation and health scoring.',
              },
              {
                title: 'Procurement Intelligence Platforms',
                desc: 'End-to-end procurement systems with bid analysis, compliance tracking, and vendor management.',
              },
              {
                title: 'Compliance Management Systems',
                desc: 'Automated compliance monitoring, audit trails, and regulatory requirement mapping.',
              },
              {
                title: 'Workflow Automation Engines',
                desc: 'Custom process automation with approval routing, task orchestration, and exception handling.',
              },
              {
                title: 'Data Integration Platforms',
                desc: 'Cross-system data consolidation, identity resolution, and unified operational data layers.',
              },
              {
                title: 'Decision Support Platforms',
                desc: 'Intelligent systems that consolidate information and surface recommendations for action.',
              },
              {
                title: 'Business Intelligence Solutions',
                desc: 'Operational analytics with custom metrics, trend analysis, and performance tracking.',
              },
              {
                title: 'Custom SaaS Applications',
                desc: 'Purpose-built multi-tenant platforms designed for specific operational domains.',
              },
              {
                title: 'Industry-Specific Operational Systems',
                desc: 'Platforms designed for the unique requirements of specific industries and regulatory environments.',
              },
            ].map((system) => (
              <div key={system.title} className="p-6 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                <h3 className="text-base font-semibold text-slate-900 mb-2">{system.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{system.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How We're Different */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
            How We&apos;re Different
          </h2>
          <div className="space-y-6">
            {[
              {
                title: 'Built on Our Technology Stack',
                desc: 'Enterprise engagements leverage the same proprietary AI, data pipelines, and platform architecture that powers our product portfolio. You benefit from proven technology, not prototype code.',
              },
              {
                title: 'We Operate What We Build',
                desc: 'Unlike agencies that hand off and disappear, Core314 maintains and evolves the systems we create. Ongoing operation, not project delivery.',
              },
              {
                title: 'Technology Transfer, Not Labor Transfer',
                desc: 'The value is in our proprietary methodology and platform components, not billable developer hours.',
              },
              {
                title: 'Selective Engagements',
                desc: 'We take on a limited number of enterprise engagements annually to maintain the development quality our systems demand.',
              },
            ].map((diff) => (
              <div key={diff.title} className="p-6 rounded-xl border border-slate-200 bg-white">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{diff.title}</h3>
                <p className="text-slate-600 leading-relaxed">{diff.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Engagement Process */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-10 text-center">
            Engagement Process
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Discovery',
                desc: 'Understand your operational reality, challenges, and requirements.',
              },
              {
                step: '02',
                title: 'Architecture',
                desc: 'Design a system around how your organization actually works.',
              },
              {
                step: '03',
                title: 'Development',
                desc: 'Build using our proven platform technology and methodology.',
              },
              {
                step: '04',
                title: 'Operation',
                desc: 'Ongoing operation, monitoring, evolution, and support.',
              },
            ].map((phase) => (
              <div key={phase.step} className="text-center p-6">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-sky-50 text-sky-600 font-bold text-lg mb-4">
                  {phase.step}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{phase.title}</h3>
                <p className="text-sm text-slate-600">{phase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Discuss Your Requirements
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Tell us about your operational challenges. We&apos;ll determine whether a
            custom system is the right solution.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Start a Conversation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
