import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            About Core314 Technologies
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            A technology company building intelligent systems for organizations
            that demand more than off-the-shelf software.
          </p>
        </div>
      </section>

      {/* Why We Exist */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
            Why Core314 Technologies Exists
          </h2>
          <div className="space-y-5 text-slate-600 text-lg leading-relaxed">
            <p>
              Many software products fail because they are designed without understanding
              the environments in which they operate. Too often, organizations are forced
              to adapt their processes to fit the limitations of existing technology rather
              than using technology that adapts to their needs.
            </p>
            <p>
              Core314 Technologies was founded on a simple observation: there is a
              fundamental gap between how organizations actually operate and how most
              software assumes they should. We exist to close that gap.
            </p>
            <p>
              The mission is not to build software. The mission is to solve complex
              business challenges through intelligent technology.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
            Our Story
          </h2>
          <div className="space-y-5 text-slate-600 text-lg leading-relaxed">
            <p>
              Core314 Technologies was founded on a simple observation: many organizations
              rely on software that was never designed around the realities of how they
              actually operate.
            </p>
            <p>
              Too often, businesses are forced to adapt their processes to fit the
              limitations of existing technology rather than using technology that
              adapts to their needs. We believed there was a better approach.
            </p>
            <p>
              Core314 Technologies was created to develop intelligent systems that align
              technology with operational reality. Our philosophy is straightforward:
              software should simplify complexity, improve visibility, support better
              decision-making, and help organizations operate more effectively.
            </p>
            <p>
              What began as a vision for building more practical, purpose-driven technology
              evolved into a company focused on developing proprietary software platforms,
              intelligent operational systems, and enterprise technologies designed to
              solve complex business challenges.
            </p>
            <p>
              Today, Core314 Technologies continues to invest in innovative products and
              solutions that help organizations gain clarity, improve performance, and
              make better decisions through technology.
            </p>
          </div>
        </div>
      </section>

      {/* What We Believe */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-10 text-center">
            What We Believe
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: 'Technology Should Fit the Business',
                description: 'Software should adapt to how organizations operate — not force organizations to change how they work. Systems must be designed around operational reality.',
              },
              {
                title: 'Own What We Build',
                description: 'We develop and operate proprietary platforms. Not one-off projects. Not white-label reselling. Technology assets we stand behind.',
              },
              {
                title: 'Ship Real Systems',
                description: 'Production-grade from day one. No prototypes disguised as products. No MVPs that never mature. Systems built to run real operations.',
              },
              {
                title: 'Long-Term Investment',
                description: 'We build technology assets with compounding value — not short-term solutions that need replacement in three years.',
              },
            ].map((belief) => (
              <div key={belief.title} className="p-6 rounded-xl border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{belief.title}</h3>
                <p className="text-slate-600 leading-relaxed">{belief.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Approach */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
            Our Approach
          </h2>
          <ul className="space-y-4">
            {[
              'Patent-pending methodologies in operational intelligence',
              'Full-stack platform development — frontend, backend, AI, and infrastructure',
              'All development is in-house — no outsourced engineering',
              'Systems designed for production from day one, not scaled-up prototypes',
              'Security and compliance built into architecture, not added later',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-sky-500 mt-2.5 flex-shrink-0" />
                <p className="text-lg text-slate-600">{item}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Long-Term Vision */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
            Long-Term Vision
          </h2>
          <div className="space-y-5 text-slate-600 text-lg leading-relaxed">
            <p>
              Core314 Technologies is building a portfolio of intelligent technology
              platforms that serve organizations across industries. Each platform
              addresses a distinct operational domain. Each is designed to operate
              independently. Each is built to solve real business challenges.
            </p>
            <p>
              Our vision is to build the most operationally grounded technology
              company in our space — one whose products are trusted because they
              are designed around how organizations actually function, not how
              software companies imagine they should.
            </p>
          </div>
          <div className="mt-10">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-base font-medium text-sky-600 hover:text-sky-700 transition-colors"
            >
              View Our Product Portfolio <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
