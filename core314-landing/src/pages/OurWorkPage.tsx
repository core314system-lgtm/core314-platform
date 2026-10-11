import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import CtaBand from '../components/CtaBand';
import { track } from '../lib/site';

export default function OurWorkPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title="Our Work: Software We've Built | Core314 Technologies" description="See the kind of software Core314 builds, including ProCuvex, a complete bid-management platform designed, built and operated by Core314." path="/our-work" />
      <Header />
      <main>
        <section className="pt-28 pb-12 lg:pt-36 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Our work</h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              We build complete, production-grade business systems: secure, documented and designed around real workflows.
            </p>
          </div>
        </section>
        <section className="pb-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <article className="p-8 rounded-2xl border border-slate-200 grid md:grid-cols-5 gap-8 items-center">
              <div className="md:col-span-3">
                <p className="text-sm font-semibold text-sky-700 uppercase tracking-wide">Core314 product</p>
                <h2 className="mt-2 text-3xl font-bold">ProCuvex</h2>
                <p className="mt-4 text-slate-700 leading-relaxed">
                  A bid-management platform for government contractors. It brings opportunity tracking, requirement analysis,
                  subcontractor quotes, compliance checks and bid decisions into one guided workflow, a process that is usually spread
                  across spreadsheets, email and shared drives.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link to="/our-work/procuvex" className="inline-flex justify-center px-5 py-3 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg" onClick={() => track('cta_click', { location: 'our_work', cta: 'explore_procuvex' })}>
                    Explore ProCuvex
                  </Link>
                  <Link to="/contact?interest=custom" className="inline-flex justify-center px-5 py-3 font-semibold text-slate-800 border border-slate-300 hover:border-slate-500 rounded-lg" onClick={() => track('cta_click', { location: 'our_work', cta: 'discuss_custom' })}>
                    Discuss a Custom Solution
                  </Link>
                </div>
              </div>
              <ul className="md:col-span-2 space-y-2 text-sm text-slate-700">
                {['Document reading and requirement extraction with AI', 'Workflow with approval gates', 'Portal for outside parties (subcontractors)', 'Role-based access, MFA, single sign-on, audit logs', 'Automated backups, monitoring and tests'].map((f) => (
                  <li key={f} className="p-3 rounded-lg bg-slate-50 border border-slate-200">{f}</li>
                ))}
              </ul>
            </article>
            <div className="mt-10 p-8 rounded-2xl bg-slate-50 border border-slate-200">
              <h2 className="text-2xl font-bold">What this means for your project</h2>
              <p className="mt-3 text-slate-700 leading-relaxed">
                The same building blocks (document intake, workflow and approvals, outside-party portals, dashboards and secure
                access) apply to staffing, property management, distribution, construction and professional services. Client case
                studies will be added here as projects are completed and approved for publication.
              </p>
            </div>
          </div>
        </section>
        <CtaBand location="our_work" />
      </main>
      <Footer />
    </div>
  );
}
