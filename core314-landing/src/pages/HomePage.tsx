import { Link } from 'react-router-dom';
import { ArrowRight, Eye, Brain, Zap, Shield, BarChart3, Target } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* SECTION 1: HERO — THE OPERATOR STORY */}
      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
            Technology Built from{' '}
            <span className="text-sky-600">Operational Experience</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Core314 Technologies develops proprietary software platforms and intelligent
            systems informed by decades of real-world operational experience. We build
            technology designed around how organizations actually operate.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/solutions"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Explore Solutions
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/enterprise"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Enterprise Systems
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2: BUSINESS OUTCOMES */}
      <section className="py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              What Changes When Your Systems Are Built by Operators
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Technology informed by operational reality delivers measurable outcomes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Eye,
                title: 'Visibility',
                description: 'See across systems, teams, and operations in real time. No blind spots.',
              },
              {
                icon: Brain,
                title: 'Better Decisions',
                description: 'Act on real intelligence, not gut feel or incomplete data.',
              },
              {
                icon: Zap,
                title: 'Reduced Friction',
                description: 'Remove the manual processes and workarounds that slow your operations every day.',
              },
              {
                icon: Shield,
                title: 'Built-In Compliance',
                description: 'Governance and compliance woven into system architecture, not bolted on as checklists.',
              },
              {
                icon: BarChart3,
                title: 'Actionable Intelligence',
                description: 'Turn fragmented data into insight that drives action.',
              },
              {
                icon: Target,
                title: 'Faster Execution',
                description: 'Move from identifying problems to solving them in less time.',
              },
            ].map((outcome) => (
              <div key={outcome.title} className="p-6 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                <outcome.icon className="h-8 w-8 text-sky-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{outcome.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{outcome.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: OUR SOLUTIONS */}
      <section className="py-20 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Systems That Solve Operational Challenges
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              We develop technology across four core domains — each driven by real operational needs.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {[
              {
                title: 'Intelligent Decision Support',
                problem: 'When decisions depend on data scattered across systems, teams, and formats.',
                link: '/solutions/decision-support',
              },
              {
                title: 'Operational Visibility & Insight',
                problem: 'When leadership lacks real-time visibility into operational health across the organization.',
                link: '/solutions/operational-intelligence',
              },
              {
                title: 'Process & Compliance Automation',
                problem: 'When manual processes, compliance gaps, and workflow friction drain time and introduce risk.',
                link: '/solutions/process-automation',
              },
              {
                title: 'Custom Operational Systems',
                problem: 'When off-the-shelf software doesn\'t match how your organization actually operates.',
                link: '/solutions/custom-systems',
              },
            ].map((solution) => (
              <Link
                key={solution.title}
                to={solution.link}
                className="group p-8 bg-white rounded-xl border border-slate-200 hover:border-sky-200 hover:shadow-md transition-all"
              >
                <h3 className="text-xl font-semibold text-slate-900 mb-3 group-hover:text-sky-600 transition-colors">
                  {solution.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-4">{solution.problem}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600">
                  Explore <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: PRODUCT PORTFOLIO */}
      <section className="py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Platforms We Build and Operate
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Each product is born from direct operational experience in its target domain.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Procuvex */}
            <div className="p-8 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center">
                  <span className="text-sky-600 font-bold text-sm">Px</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">Procuvex</h3>
              </div>
              <p className="text-slate-600 leading-relaxed mb-4">
                AI-powered procurement intelligence for government contractors and enterprise
                procurement teams. Task order analysis, bid intelligence, and compliance
                automation — built from direct experience in government contracting operations.
              </p>
              <Link
                to="/products/procuvex"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
              >
                Learn More <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Portfolio Pipeline */}
            <div className="p-8 rounded-xl border border-slate-200 bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Technology Under Development</h3>
              <p className="text-slate-600 leading-relaxed mb-5">
                Core314 Technologies develops multiple platforms addressing distinct
                operational domains. New platforms are announced at production readiness.
              </p>
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Active development areas:</p>
                <ul className="space-y-2">
                  {[
                    'Operational Intelligence',
                    'Decision Support Systems',
                    'Data Intelligence Platforms',
                    'Workflow Automation Technologies',
                  ].map((area) => (
                    <li key={area} className="flex items-center gap-2 text-sm text-slate-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
            >
              View Full Portfolio <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 5: ENTERPRISE SOLUTIONS */}
      <section className="py-20 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Systems We Build for Complex Organizations
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
              For organizations whose operational complexity exceeds what off-the-shelf
              software can address, we design and build proprietary systems using our
              proven technology and operational methodology.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              'Operational Command Centers',
              'Executive Dashboards',
              'Procurement Intelligence',
              'Compliance Management',
              'Data Integration Platforms',
              'Workflow Automation',
              'Decision Support Platforms',
              'Custom SaaS Applications',
              'Business Intelligence',
              'Industry-Specific Systems',
            ].map((system) => (
              <div
                key={system}
                className="p-4 bg-white rounded-lg border border-slate-200 text-center"
              >
                <p className="text-sm font-medium text-slate-700">{system}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              to="/enterprise"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Discuss Your Requirements
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 6: INDUSTRY EXPERTISE */}
      <section className="py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Operational Experience Across Industries
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
              Our technology is informed by direct experience in complex, regulated,
              and high-stakes environments.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Government Contracting',
                details: 'Task orders, compliance, proposals, subcontractor management',
              },
              {
                title: 'Facilities Management',
                details: 'Multi-site operations, workforce coordination, asset management',
              },
              {
                title: 'Infrastructure & Logistics',
                details: 'Supply chain, fleet management, field operations, asset tracking',
              },
              {
                title: 'Operations Management',
                details: 'Planning, resource allocation, cross-team coordination, performance',
              },
              {
                title: 'Enterprise Services',
                details: 'Large-scale service delivery, SLA management, operational reporting',
              },
              {
                title: 'Professional Services',
                details: 'Project delivery, resource planning, utilization, managed services',
              },
            ].map((industry) => (
              <div key={industry.title} className="p-6 rounded-xl border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{industry.title}</h3>
                <p className="text-sm text-slate-600">{industry.details}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-sm text-slate-500 max-w-2xl mx-auto">
            These industries represent areas where Core314 Technologies has significant operational
            experience. Our technology principles apply across many sectors.
          </p>
          <div className="text-center mt-6">
            <Link
              to="/industries"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
            >
              Learn More <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 7: WHY CORE314 TECHNOLOGIES */}
      <section className="py-20 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Why Organizations Choose Core314 Technologies
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              {
                vs: 'Software Development Agencies',
                them: 'Agencies build projects.',
                us: 'We build technology assets.',
              },
              {
                vs: 'Consulting Firms',
                them: 'Consultants provide recommendations.',
                us: 'We develop systems that execute.',
              },
              {
                vs: 'Traditional SaaS Vendors',
                them: 'Most SaaS products force businesses to adapt.',
                us: 'We build systems around operational reality.',
              },
              {
                vs: 'Systems Integrators',
                them: 'Integrators connect existing tools.',
                us: 'We create new capabilities through proprietary technology.',
              },
            ].map((diff) => (
              <div key={diff.vs} className="p-6 bg-white rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  vs. {diff.vs}
                </p>
                <p className="text-sm text-slate-500 mb-2">{diff.them}</p>
                <p className="text-base font-semibold text-slate-900">{diff.us}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {[
              'Operationally Informed',
              'Proprietary Platforms',
              'Product Ownership',
              'Selective Engagements',
              'Long-Term Investment',
              'In-House Development',
            ].map((point) => (
              <div key={point} className="text-center p-3">
                <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: CREDIBILITY */}
      <section className="py-16 lg:py-20 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">Patent Pending</p>
              <p className="text-sm text-slate-600 mt-1">
                Proprietary methodology in operational intelligence technology
              </p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Operational Origins</p>
              <p className="text-sm text-slate-600 mt-1">
                Every system built from real-world operational experience
              </p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Multiple Platforms</p>
              <p className="text-sm text-slate-600 mt-1">
                Active product portfolio with ongoing development
              </p>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
            >
              About Core314 Technologies <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
