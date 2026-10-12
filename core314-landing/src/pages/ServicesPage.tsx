import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import CtaBand from '../components/CtaBand';
import { services } from '../content/services';

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title="Services: Custom Software, Automation & Integration | Core314" description="Custom business software, workflow automation, system integration, dashboards and practical AI, designed around how your business operates." path="/services" />
      <Header />
      <main>
        <section className="pt-28 pb-12 lg:pt-36 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">What we build</h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Every engagement starts with your workflow, not a product we need to sell. Most clients combine two or more of these.
            </p>
          </div>
        </section>
        <section className="pb-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {services.map((s) => (
              <Link key={s.slug} to={`/services/${s.slug}`} className="block p-8 rounded-xl border border-slate-200 hover:border-sky-300 hover:shadow-sm">
                <h2 className="text-2xl font-bold">{s.name}</h2>
                <p className="mt-3 text-slate-600 leading-relaxed">{s.short}</p>
                <span className="mt-4 inline-flex items-center gap-1 font-semibold text-sky-700">
                  How {s.name.toLowerCase()} works <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <CtaBand location="services" />
      </main>
      <Footer />
    </div>
  );
}
