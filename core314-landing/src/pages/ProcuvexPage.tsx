import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import { track } from '../lib/site';

const capabilities = [
  { title: 'Opportunity search & pipeline', text: 'Find and import SAM.gov opportunities, track them through a pipeline and see deadlines on a calendar.' },
  { title: 'AI requirement analysis', text: 'Reads solicitation documents and extracts scope, deliverables, evaluation method and key requirements.' },
  { title: 'Automated compliance matrix', text: 'Maps Section L and M requirements into a compliance matrix the proposal team can work from.' },
  { title: 'Subcontractor quotes', text: 'Sends RFQ packages, collects quotes through a portal and scores them for compliance and pricing risk.' },
  { title: 'Screening & checks', text: 'SAM.gov exclusion screening and approval gates before anything is sent or submitted.' },
  { title: 'Bid decisions & proposals', text: 'Capture gates, pricing decision matrix, bid summary and AI-assisted drafts that only cite data you provide.' },
];

export default function ProcuvexPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ProCuvex',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Bid-management platform for government contractors, developed by Core314 Technologies.',
    publisher: { '@type': 'Organization', name: 'Core314 Technologies LLC', url: 'https://core314.com' },
  };
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title="ProCuvex: Bid Management for Government Contractors | Core314" description="ProCuvex is a Core314 product that helps government contractors analyze solicitations, collect subcontractor quotes, check compliance and make bid decisions." path="/our-work/procuvex" jsonLd={jsonLd} />
      <Header />
      <main>
        <section className="pt-28 pb-12 lg:pt-36 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link to="/our-work" className="text-sm font-medium text-sky-700 hover:text-sky-800">&larr; Our work</Link>
            <p className="mt-6 text-sm font-semibold text-sky-700 uppercase tracking-wide">A Core314 Technologies product</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight">ProCuvex</h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              Government contractors juggle solicitations, compliance requirements, subcontractor quotes and tight deadlines across
              spreadsheets and email. ProCuvex brings that work into one guided bid workflow, from finding an opportunity to the final
              bid decision.
            </p>
          </div>
        </section>
        <section className="py-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold">What it does</h2>
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {capabilities.map((c) => (
                <div key={c.title} className="p-6 rounded-xl border border-slate-200">
                  <h3 className="text-lg font-semibold">{c.title}</h3>
                  <p className="mt-2 text-slate-700">{c.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-600">
              ProCuvex is a separate product with its own application, data and accounts. It is owned by Core314 Technologies and is
              not connected to this website.
            </p>
          </div>
        </section>
        <section className="py-16 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-6">
            <div className="p-8 rounded-2xl bg-white border border-slate-200">
              <h2 className="text-xl font-bold">Want something like this for your business?</h2>
              <p className="mt-3 text-slate-700">We can design and build a system like ProCuvex around your own workflow, in any industry.</p>
              <Link to="/contact?interest=custom" onClick={() => track('cta_click', { location: 'procuvex', cta: 'discuss_custom' })} className="mt-6 inline-flex px-5 py-3 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
                Discuss a Custom Solution
              </Link>
            </div>
            <div className="p-8 rounded-2xl bg-white border border-slate-200">
              <h2 className="text-xl font-bold">Interested in using ProCuvex?</h2>
              <p className="mt-3 text-slate-700">Ask about a demonstration, availability and licensing options for your organization.</p>
              <Link to="/contact?interest=procuvex" onClick={() => track('cta_click', { location: 'procuvex', cta: 'procuvex_inquiry' })} className="mt-6 inline-flex px-5 py-3 font-semibold text-slate-800 border border-slate-300 hover:border-slate-500 rounded-lg">
                Request a ProCuvex Demo
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
