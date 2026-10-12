import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Seo from '../components/Seo';
import { BOOKING_URL, getLeadSource, track } from '../lib/site';

const interests: Record<string, string> = {
  custom: 'Custom software / automation project',
  procuvex: 'ProCuvex product inquiry',
  other: 'Something else',
};
const timelines = ['As soon as possible', 'Within 3 months', '3-6 months', 'Just exploring'];
const sources = ['Search engine', 'LinkedIn', 'Referral', 'ProCuvex', 'Event', 'Other'];

const empty = { name: '', company: '', email: '', challenge: '', tools: '', timeline: '', source: '', website: '' };

const field = 'w-full px-4 py-3 text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600';

export default function ContactPage() {
  const [params] = useSearchParams();
  const initialInterest = params.get('interest') && interests[params.get('interest') as string] ? (params.get('interest') as string) : 'custom';
  const [interest, setInterest] = useState(initialInterest);
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setError('');
    try {
      const res = await fetch('/.netlify/functions/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, interest: interests[interest], lead: getLeadSource() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestMode(Boolean(data.test));
        track('generate_lead', { form: 'contact', interest });
        if (interest === 'procuvex') track('procuvex_demo_inquiry', { form: 'contact' });
        setStatus('success');
        setForm(empty);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setError('Unable to submit. Please check your connection and try again.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo title="Schedule a Business Workflow Discovery Call | Core314" description="Book a free 20-minute Business Workflow Discovery Call or send us a note about the work you'd like to automate or improve." path="/contact" />
      <Header />
      <main>
        <section className="pt-28 pb-10 lg:pt-36 bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Book a Business Workflow Discovery Call</h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              A free, 20-minute conversation about your operational challenges. We'll listen, ask a few questions and tell you
              honestly whether custom software makes sense. No obligation.
            </p>
          </div>
        </section>

        <section className="pb-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-5 gap-10">
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50">
                <CalendarDays className="h-7 w-7 text-sky-700" aria-hidden="true" />
                <h2 className="mt-3 text-xl font-semibold">Pick a time</h2>
                {BOOKING_URL ? (
                  <>
                    <p className="mt-2 text-slate-700">Choose a 20-minute slot that works for you. You'll get a calendar invitation right away.</p>
                    <a
                      href={BOOKING_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track('booking_click', { location: 'contact' })}
                      className="mt-4 inline-flex w-full justify-center px-5 py-3 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                    >
                      Schedule a 20-Minute Consultation
                    </a>
                  </>
                ) : (
                  <p className="mt-2 text-slate-700">Send the short form and we'll reply within one business day with times for your call.</p>
                )}
              </div>
              <div className="p-6 rounded-xl border border-slate-200">
                <h2 className="text-lg font-semibold">What to expect</h2>
                <ul className="mt-3 space-y-2 text-slate-700 list-disc pl-5">
                  <li>We learn how the work flows today</li>
                  <li>We point out quick wins, even if they don't involve us</li>
                  <li>If there's a fit, we suggest a next step and rough scope</li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-3">
              {status === 'success' ? (
                <div className="p-8 rounded-xl border border-green-200 bg-green-50 text-center" role="status">
                  <CheckCircle2 className="h-12 w-12 text-green-700 mx-auto" aria-hidden="true" />
                  <h2 className="mt-4 text-2xl font-bold">Thanks, we've got it</h2>
                  <p className="mt-2 text-slate-700">We've emailed you a confirmation and will reply within one business day.</p>
                  {testMode && <p className="mt-3 text-sm font-semibold text-amber-800">Staging test: this submission was not saved and no emails were sent.</p>}
                  <Link to="/our-work" className="mt-6 inline-block font-semibold text-sky-700">While you wait, see what we build &rarr;</Link>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5" noValidate={false}>
                  <h2 className="text-xl font-semibold">Prefer to write? Tell us a little about it</h2>
                  <fieldset>
                    <legend className="block text-sm font-medium text-slate-800 mb-2">I'm interested in</legend>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(interests).map(([k, v]) => (
                        <label key={k} className={`px-3 py-2 text-sm rounded-lg border cursor-pointer ${interest === k ? 'border-sky-700 bg-sky-50 text-sky-900' : 'border-slate-300'}`}>
                          <input type="radio" name="interest" value={k} checked={interest === k} onChange={() => setInterest(k)} className="sr-only" />
                          {v}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-800 mb-1.5">Name *</label>
                      <input id="name" required maxLength={200} autoComplete="name" value={form.name} onChange={set('name')} className={field} />
                    </div>
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-slate-800 mb-1.5">Company</label>
                      <input id="company" maxLength={200} autoComplete="organization" value={form.company} onChange={set('company')} className={field} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-800 mb-1.5">Work email *</label>
                    <input id="email" type="email" required maxLength={320} autoComplete="email" value={form.email} onChange={set('email')} className={field} />
                  </div>
                  <div>
                    <label htmlFor="challenge" className="block text-sm font-medium text-slate-800 mb-1.5">What's the business challenge? *</label>
                    <textarea id="challenge" required minLength={10} maxLength={5000} rows={4} value={form.challenge} onChange={set('challenge')} className={field} placeholder="e.g. We re-type every order into three systems and approvals take days." />
                  </div>
                  <div>
                    <label htmlFor="tools" className="block text-sm font-medium text-slate-800 mb-1.5">Software or tools you use today</label>
                    <input id="tools" maxLength={500} value={form.tools} onChange={set('tools')} className={field} placeholder="e.g. QuickBooks, Excel, Salesforce" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="timeline" className="block text-sm font-medium text-slate-800 mb-1.5">Approximate timeline</label>
                      <select id="timeline" value={form.timeline} onChange={set('timeline')} className={field}>
                        <option value="">Select...</option>
                        {timelines.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="source" className="block text-sm font-medium text-slate-800 mb-1.5">How did you find us?</label>
                      <select id="source" value={form.source} onChange={set('source')} className={field}>
                        <option value="">Select...</option>
                        {sources.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <label htmlFor="website">Leave this field empty</label>
                    <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                  </div>
                  {status === 'error' && (
                    <p className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg" role="alert">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
                    </p>
                  )}
                  <button type="submit" disabled={status === 'submitting'} className="inline-flex w-full justify-center items-center gap-2 px-6 py-3.5 font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg">
                    <Send className="h-4 w-4" aria-hidden="true" /> {status === 'submitting' ? 'Sending...' : 'Send my request'}
                  </button>
                  <p className="text-xs text-slate-600">We use your details only to respond to your inquiry. See our <Link to="/privacy" className="underline">privacy policy</Link>.</p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
