import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import CtaBand from '../components/CtaBand';

const values = [
  { title: 'Understand the work first', text: 'We spend time with the people who do the work before we design anything.' },
  { title: 'Practical over flashy', text: 'We choose the simplest technology that solves the problem reliably, including AI only when it helps.' },
  { title: 'Transparent terms', text: 'Scope, price, timeline and ownership terms are written down before development begins.' },
  { title: 'Built to last', text: 'Documented, tested, secure software your team can rely on, not a fragile prototype.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title="About Core314 Technologies | Custom Software Company" description="Core314 Technologies builds custom software, automation and integrations for businesses across industries, designed around how each customer operates." path="/about" />
      <Header />
      <main>
        <section className="pt-28 pb-12 lg:pt-36 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">About Core314 Technologies</h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Core314 Technologies LLC is a custom software company. We help organizations replace repetitive, manual work with
              software designed around how they actually operate, whether that means a complete business application, a set of
              automations, or simply connecting the tools they already have.
            </p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              We also design, build and operate our own software products, including{' '}
              <Link to="/our-work/procuvex" className="font-semibold text-sky-700 hover:text-sky-800">ProCuvex</Link>, a bid-management
              platform for government contractors. Running our own product keeps us accountable for the same things our clients care
              about: reliability, security and software people actually use.
            </p>
          </div>
        </section>
        <section className="py-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold">How we think about software</h2>
            <div className="mt-6 grid sm:grid-cols-2 gap-6">
              {values.map((v) => (
                <div key={v.title} className="p-6 rounded-xl border border-slate-200">
                  <h3 className="text-lg font-semibold">{v.title}</h3>
                  <p className="mt-2 text-slate-700">{v.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <CtaBand location="about" />
      </main>
      <Footer />
    </div>
  );
}
