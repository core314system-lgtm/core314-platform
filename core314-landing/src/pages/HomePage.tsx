import { Link } from 'react-router-dom';
import { ArrowRight, Keyboard, Unplug, CheckSquare, FileSpreadsheet, EyeOff, Clock, Code2, Workflow, Link2, BarChart3, Sparkles } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import CtaBand from '../components/CtaBand';
import { services } from '../content/services';
import { faqs } from '../content/faq';
import { CONSULT_PATH, track } from '../lib/site';

const problems = [
  { icon: Keyboard, title: 'Repetitive data entry', text: 'The same information typed into several places, by people who should be doing more valuable work.' },
  { icon: Unplug, title: "Systems that don't talk", text: 'Accounting, CRM, scheduling and spreadsheets that each hold part of the picture.' },
  { icon: CheckSquare, title: 'Manual approvals', text: 'Requests waiting in inboxes, with no clear view of who has them or how long they have waited.' },
  { icon: FileSpreadsheet, title: 'Spreadsheet-run processes', text: 'Critical work living in files that only one or two people fully understand.' },
  { icon: EyeOff, title: 'Limited visibility', text: 'Leaders chasing updates instead of seeing current numbers at a glance.' },
  { icon: Clock, title: 'Time lost to admin', text: 'Hours every week spent on status emails, reminders and rebuilding the same documents.' },
];

const serviceIcons = [Code2, Workflow, Link2, BarChart3, Sparkles];

const industries = [
  { name: 'Staffing', example: 'Candidate intake, credential tracking, timesheet-to-invoice automation.' },
  { name: 'Property management', example: 'Maintenance requests, vendor dispatch, owner reporting, lease renewals.' },
  { name: 'Distribution', example: 'Order flow into inventory and accounting, delivery status, exception alerts.' },
  { name: 'Professional services', example: 'Client intake, engagement tracking, document assembly, utilization reporting.' },
  { name: 'Construction', example: 'Bids and estimates, subcontractor compliance, change orders, job-cost dashboards.' },
  { name: 'Government contracting', example: 'Opportunity tracking, proposal compliance, subcontractor quotes. See ProCuvex.' },
];

const steps = [
  { n: '1', title: 'Discovery', text: 'A free 20-minute call, then a deeper look at the workflow that matters most.' },
  { n: '2', title: 'Scope', text: 'A written plan with what we will build, the timeline, the price and ownership terms.' },
  { n: '3', title: 'Build & test', text: 'Short development cycles, with working software for you to review early and often.' },
  { n: '4', title: 'Launch & support', text: 'Deployment, training and documentation, with optional ongoing support.' },
];

const why = [
  { title: 'Built around your process', text: 'We design for the way your team works, not a generic template.' },
  { title: 'Business outcomes first', text: 'We focus on hours saved, errors avoided and visibility gained, not technology for its own sake.' },
  { title: 'Flexible engagements', text: 'Start with one workflow and expand, or plan a full system. Your choice.' },
  { title: 'Clear ownership terms', text: 'Ownership, licensing and delivery terms are clearly established in writing before development begins.' },
  { title: 'Proven product experience', text: 'We build and operate our own complex software platform, ProCuvex, not just client prototypes.' },
  { title: 'Straight answers', text: "If off-the-shelf software or a simple fix is the better choice, we'll tell you." },
];

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Core314 Technologies LLC',
      url: 'https://core314.com',
      logo: 'https://core314.com/logo-icon.svg',
      description: 'Custom software development, workflow automation and system integration for businesses across industries.',
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title="Custom Software & Workflow Automation | Core314 Technologies"
        description="Core314 builds custom software that eliminates repetitive work, connects disconnected systems and gives your team time back. Schedule a free 20-minute consultation."
        path="/"
        jsonLd={orgJsonLd}
      />
      <Header />
      <main>
        <section className="pt-28 pb-20 lg:pt-36 lg:pb-28 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-semibold tracking-wide text-sky-700 uppercase">Custom software &amp; business automation</p>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Your Business Is Unique.{' '}
              <span className="text-sky-700">Your Software Should Be Too.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              We build custom software that eliminates repetitive work, connects disconnected systems, and gives your
              team more time to focus on growing your business.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={CONSULT_PATH}
                onClick={() => track('cta_click', { location: 'hero', cta: 'schedule_consultation' })}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Schedule a 20-Minute Consultation <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/our-work"
                onClick={() => track('cta_click', { location: 'hero', cta: 'see_what_we_build' })}
                className="inline-flex items-center px-6 py-3.5 text-base font-semibold text-slate-800 border border-slate-300 hover:border-slate-500 rounded-lg"
              >
                See What We Can Build
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-600">Free, no-obligation conversation. For businesses in any industry.</p>
          </div>
        </section>

        <section className="py-20" aria-labelledby="problems">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="problems" className="text-3xl sm:text-4xl font-bold text-center">Business problems we solve</h2>
            <p className="mt-4 text-lg text-slate-600 text-center max-w-3xl mx-auto">
              Most growing organizations lose hours every week to work that software could handle. Sound familiar?
            </p>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {problems.map((p) => (
                <div key={p.title} className="p-6 rounded-xl border border-slate-200">
                  <p.icon className="h-7 w-7 text-sky-700" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-slate-600">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-slate-50" aria-labelledby="solutions">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="solutions" className="text-3xl sm:text-4xl font-bold text-center">Custom solutions we build</h2>
            <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s, i) => {
                const Icon = serviceIcons[i];
                return (
                  <Link key={s.slug} to={`/services/${s.slug}`} className="group p-6 rounded-xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-sm">
                    <Icon className="h-7 w-7 text-sky-700" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-semibold">{s.name}</h3>
                    <p className="mt-2 text-slate-600">{s.short}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700">
                      Learn about {s.name.toLowerCase()} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20" aria-labelledby="industries">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="industries" className="text-3xl sm:text-4xl font-bold text-center">Built for how your industry works</h2>
            <p className="mt-4 text-lg text-slate-600 text-center max-w-3xl mx-auto">
              Examples of what custom software can do in different industries. These are typical use cases, not a limit on what we build.
            </p>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {industries.map((x) => (
                <div key={x.name} className="p-6 rounded-xl border border-slate-200">
                  <h3 className="text-lg font-semibold">{x.name}</h3>
                  <p className="mt-2 text-slate-600">{x.example}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link to="/industries" className="font-semibold text-sky-700 hover:text-sky-800">See more industry use cases &rarr;</Link>
            </p>
          </div>
        </section>

        <section className="py-20 bg-slate-50" aria-labelledby="process">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="process" className="text-3xl sm:text-4xl font-bold text-center">How we work</h2>
            <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((s) => (
                <li key={s.n} className="p-6 rounded-xl bg-white border border-slate-200">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-700 text-white font-bold">{s.n}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-slate-600">{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center">
              <Link to="/how-we-work" className="font-semibold text-sky-700 hover:text-sky-800">Read about our full process &rarr;</Link>
            </p>
          </div>
        </section>

        <section className="py-20" aria-labelledby="our-work">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-semibold tracking-wide text-sky-700 uppercase">Our work</p>
              <h2 id="our-work" className="mt-2 text-3xl sm:text-4xl font-bold">ProCuvex: a platform we designed, built and run</h2>
              <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                ProCuvex is a Core314 product that helps government contractors manage the bid process, from finding
                opportunities to analyzing requirements, collecting subcontractor quotes and checking compliance. It shows
                the kind of complete, secure business system we can build for you.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link to="/contact?interest=custom" onClick={() => track('cta_click', { location: 'home_our_work', cta: 'discuss_custom' })} className="inline-flex justify-center items-center px-5 py-3 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
                  Discuss a Custom Solution
                </Link>
                <Link to="/our-work/procuvex" onClick={() => track('cta_click', { location: 'home_our_work', cta: 'explore_procuvex' })} className="inline-flex justify-center items-center px-5 py-3 font-semibold text-slate-800 border border-slate-300 hover:border-slate-500 rounded-lg">
                  Explore ProCuvex
                </Link>
              </div>
            </div>
            <ul className="grid sm:grid-cols-2 gap-4 text-slate-700">
              {['AI reading of requirement documents', 'Automated compliance matrices', 'Subcontractor quote collection & scoring', 'Approval-gated AI drafting', 'Role-based access, MFA and audit logs', 'Nightly backups and health monitoring'].map((f) => (
                <li key={f} className="p-4 rounded-lg bg-slate-50 border border-slate-200">{f}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-20 bg-slate-50" aria-labelledby="why">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="why" className="text-3xl sm:text-4xl font-bold text-center">Why Core314</h2>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {why.map((w) => (
                <div key={w.title} className="p-6 rounded-xl bg-white border border-slate-200">
                  <h3 className="text-lg font-semibold">{w.title}</h3>
                  <p className="mt-2 text-slate-600">{w.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20" aria-labelledby="faq">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="faq" className="text-3xl sm:text-4xl font-bold text-center">Frequently asked questions</h2>
            <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
              {faqs.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="cursor-pointer list-none flex justify-between gap-4 text-lg font-semibold">
                    {f.q}
                    <span className="text-sky-700 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 text-slate-600 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <CtaBand location="home_final" />
      </main>
      <Footer />
    </div>
  );
}
