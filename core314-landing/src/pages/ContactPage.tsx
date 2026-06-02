import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Building2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Contact Core314 Technologies
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Whether you&apos;re exploring our products or discussing enterprise
            requirements, we&apos;d welcome the conversation.
          </p>
        </div>
      </section>

      {/* Two Paths */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* General Inquiry */}
            <div className="p-8 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-sky-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">General Inquiry</h2>
              </div>
              <p className="text-slate-600 leading-relaxed mb-6">
                Questions about Core314 Technologies, our products, partnerships, or
                general information.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  'Product information',
                  'Partnership opportunities',
                  'Media and press inquiries',
                  'General questions',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:info@core314.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Email info@core314.com
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Enterprise Inquiry */}
            <div className="p-8 rounded-xl border border-sky-200 bg-sky-50/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-sky-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Enterprise Inquiry</h2>
              </div>
              <p className="text-slate-600 leading-relaxed mb-6">
                Organizations seeking custom technology solutions, proprietary platform
                development, or enterprise-grade operational systems.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  'Custom system requirements',
                  'Enterprise platform development',
                  'Operational technology assessment',
                  'Discovery engagement',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:enterprise@core314.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
              >
                Email enterprise@core314.com
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
            What to Expect
          </h2>
          <div className="space-y-4">
            {[
              'We respond to all inquiries within 2 business days.',
              'Enterprise inquiries receive a discovery call invitation within 48 hours.',
              'We do not engage in pressure sales tactics. If there\'s a fit, we\'ll know.',
              'Initial enterprise conversations are focused on understanding your operational reality.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-sky-500 mt-2 flex-shrink-0" />
                <p className="text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alternative Navigation */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Not Sure Where to Start?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
            >
              Explore Products
            </Link>
            <Link
              to="/solutions"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
            >
              Explore Solutions
            </Link>
            <Link
              to="/enterprise"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
            >
              Enterprise Systems
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
