import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import CtaBand from '../components/CtaBand';
import { services } from '../content/services';
import NotFoundPage from './NotFoundPage';

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((i) => (
        <li key={i} className="flex gap-3 text-slate-700">
          <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-sky-700" aria-hidden="true" />
          {i}
        </li>
      ))}
    </ul>
  );
}

export default function ServicePage() {
  const { slug } = useParams();
  const s = services.find((x) => x.slug === slug);
  if (!s) return <NotFoundPage />;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.metaDescription,
    provider: { '@type': 'Organization', name: 'Core314 Technologies LLC', url: 'https://core314.com' },
    areaServed: 'US',
  };
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title={s.metaTitle} description={s.metaDescription} path={`/services/${s.slug}`} jsonLd={jsonLd} />
      <Header />
      <main>
        <section className="pt-28 pb-12 lg:pt-36 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link to="/services" className="text-sm font-medium text-sky-700 hover:text-sky-800">&larr; All services</Link>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">{s.name}</h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">{s.short}</p>
          </div>
        </section>
        <section className="py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-2xl font-bold">The problem</h2>
              <List items={s.problem} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">How we address it</h2>
              <List items={s.approach} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Example workflows</h2>
              <List items={s.workflows} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Potential benefits</h2>
              <List items={s.benefits} />
              <p className="mt-4 text-sm text-slate-600">Actual results depend on your processes and scope; we estimate them with you during discovery.</p>
            </div>
          </div>
        </section>
        <section className="py-12 bg-slate-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold">How the engagement works</h2>
            <p className="mt-4 text-slate-700 leading-relaxed">
              We start with a free 20-minute discovery call. If there's a fit, we map the workflow, give you a written scope with
              timeline, price and ownership terms, then build in short cycles with regular reviews. After launch we train your team
              and offer optional ongoing support. <Link to="/how-we-work" className="font-semibold text-sky-700 hover:text-sky-800">Read about our process</Link>.
            </p>
            <h2 className="mt-12 text-2xl font-bold">Common questions</h2>
            <dl className="mt-4 space-y-6">
              {s.faq.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold">{f.q}</dt>
                  <dd className="mt-1 text-slate-700">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <CtaBand location={`service_${s.slug}`} />
      </main>
      <Footer />
    </div>
  );
}
