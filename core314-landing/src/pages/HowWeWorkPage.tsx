import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import CtaBand from '../components/CtaBand';

const steps = [
  { title: 'Discovery call (free, 20 minutes)', text: 'We learn about your business, the work that is slowing your team down, and the tools you use today. You get an honest view of whether custom software is the right answer.' },
  { title: 'Workflow mapping', text: 'For a good fit, we map the process step by step with the people who do the work, and identify where time, errors and delays come from.' },
  { title: 'Written scope', text: 'You receive a plain-language scope: what we will build, what it will not do, the timeline, the price, and the ownership, licensing and delivery terms. Nothing starts until you approve it.' },
  { title: 'Development in short cycles', text: 'We build in small increments and show you working software regularly, so you can give feedback early and change priorities as you learn.' },
  { title: 'Testing', text: 'Each release is tested against the scenarios we agreed on, including the unusual cases. You and your team test it too before launch.' },
  { title: 'Deployment', text: 'We launch carefully, with a rollback plan, and move any existing data you need into the new system.' },
  { title: 'Training & documentation', text: 'We train your team and provide documentation so the system does not depend on any one person.' },
  { title: 'Support & improvement', text: 'Choose an optional support plan for fixes, updates and new features, or take over maintenance yourself.' },
];

export default function HowWeWorkPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title="How We Work: From Discovery to Launch | Core314" description="Our process: free discovery call, workflow mapping, written scope with clear ownership terms, development in short cycles, testing, launch, training and support." path="/how-we-work" />
      <Header />
      <main>
        <section className="pt-28 pb-12 lg:pt-36 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">How we work</h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">A clear, low-risk process. You always know what is being built, what it costs and when it will be ready.</p>
          </div>
        </section>
        <section className="pb-20">
          <ol className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-5 p-6 rounded-xl border border-slate-200">
                <span className="flex-none inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-700 text-white font-bold">{i + 1}</span>
                <div>
                  <h2 className="text-xl font-semibold">{s.title}</h2>
                  <p className="mt-2 text-slate-700 leading-relaxed">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 p-6 rounded-xl bg-slate-50 border border-slate-200">
            <h2 className="text-xl font-semibold">Ownership and licensing</h2>
            <p className="mt-2 text-slate-700 leading-relaxed">
              We develop software tailored to your business, with ownership, licensing, and delivery terms clearly established before
              development begins. Software built specifically for you is addressed in your agreement. Pre-existing Core314 tools,
              reusable components and third-party software are identified separately, along with how they are licensed to you.
            </p>
          </div>
        </section>
        <CtaBand location="how_we_work" />
      </main>
      <Footer />
    </div>
  );
}
