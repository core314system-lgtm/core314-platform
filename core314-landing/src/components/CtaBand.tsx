import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CONSULT_PATH, track } from '../lib/site';

export default function CtaBand({
  title = 'Book a Business Workflow Discovery Call',
  text = "A free, 20-minute conversation about the work that's slowing your team down. No sales pressure. We'll tell you honestly whether custom software makes sense.",
  location = 'cta_band',
}: { title?: string; text?: string; location?: string }) {
  return (
    <section className="py-20 bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">{title}</h2>
        <p className="mt-4 text-lg text-slate-300 leading-relaxed">{text}</p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={CONSULT_PATH}
            onClick={() => track('cta_click', { location, cta: 'schedule_consultation' })}
            className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors"
          >
            Schedule a 20-Minute Consultation <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            to="/our-work"
            onClick={() => track('cta_click', { location, cta: 'see_what_we_build' })}
            className="inline-flex items-center px-6 py-3.5 text-base font-semibold text-white border border-slate-500 hover:border-slate-300 rounded-lg transition-colors"
          >
            See What We Can Build
          </Link>
        </div>
      </div>
    </section>
  );
}
