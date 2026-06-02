import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function IndustriesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Industry Expertise
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            We don&apos;t study these industries from the outside. We&apos;ve operated in them.
            Our technology is built from direct experience with the challenges these
            sectors face every day.
          </p>
        </div>
      </section>

      {/* Industries */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: 'Government Contracting',
                challenges: [
                  'Complex task order management',
                  'Multi-level compliance requirements',
                  'Proposal development under tight deadlines',
                  'Subcontractor coordination and performance tracking',
                  'Federal acquisition regulation navigation',
                ],
              },
              {
                title: 'Facilities Management',
                challenges: [
                  'Multi-site operational coordination',
                  'Workforce scheduling and management',
                  'Asset lifecycle and maintenance',
                  'Service level agreement tracking',
                  'Vendor and contractor oversight',
                ],
              },
              {
                title: 'Infrastructure & Logistics',
                challenges: [
                  'Supply chain visibility and optimization',
                  'Fleet and asset management',
                  'Field operations coordination',
                  'Route and resource optimization',
                  'Real-time operational monitoring',
                ],
              },
              {
                title: 'Operations Management',
                challenges: [
                  'Cross-team coordination at scale',
                  'Resource allocation and planning',
                  'Performance visibility and reporting',
                  'Operational bottleneck identification',
                  'Process standardization',
                ],
              },
              {
                title: 'Enterprise Services',
                challenges: [
                  'Large-scale service delivery management',
                  'SLA compliance and reporting',
                  'Multi-client operational coordination',
                  'Quality assurance and performance',
                  'Escalation management',
                ],
              },
              {
                title: 'Professional Services',
                challenges: [
                  'Project delivery and execution',
                  'Resource utilization optimization',
                  'Client engagement management',
                  'Knowledge management and reuse',
                  'Capacity planning',
                ],
              },
            ].map((industry) => (
              <div key={industry.title} className="p-6 rounded-xl border border-slate-200">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">{industry.title}</h3>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Challenges We Understand
                </p>
                <ul className="space-y-2">
                  {industry.challenges.map((challenge) => (
                    <li key={challenge} className="flex items-start gap-2 text-sm text-slate-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                      {challenge}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer + CTA */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-lg text-slate-600 leading-relaxed mb-8">
            These industries represent areas where Core314 Technologies has significant
            operational experience. Our technology principles — operational grounding,
            practical system design, and real-world intelligence — apply across many sectors.
          </p>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Operating in a Complex Industry?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            If your organization faces operational challenges that generic software
            can&apos;t solve, we should talk.
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
