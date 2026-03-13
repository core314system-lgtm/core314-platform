import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, Mail, Building2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData as unknown as Record<string, string>).toString(),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sky-600 text-sm font-semibold uppercase tracking-wider mb-3">Contact</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4">
              Get in Touch
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Have questions about Core314? Want to schedule a demo? We would love to hear from you.
            </motion.p>
          </div>

          <div className="max-w-xl mx-auto">
            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">Message Sent</h2>
                <p className="text-sm text-slate-600">Thank you for reaching out. We will get back to you within one business day.</p>
              </motion.div>
            ) : (
              <motion.form
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                name="core314-contact-form"
                method="POST"
                data-netlify="true"
                netlify-honeypot="bot-field"
                onSubmit={handleSubmit}
                className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-5"
              >
                <input type="hidden" name="form-name" value="core314-contact-form" />
                <div className="hidden">
                  <input name="bot-field" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">Name *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-shadow"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-shadow"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-shadow"
                      placeholder="Company name"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-shadow"
                      placeholder="(555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-shadow resize-none"
                    placeholder="How can we help?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                  <Send className="h-4 w-4" />
                </button>
              </motion.form>
            )}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <Mail className="h-5 w-5 text-sky-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Email us at</p>
                  <a href="mailto:chris.brown@core314.com" className="text-sm font-medium text-slate-900 hover:text-sky-600 transition-colors">chris.brown@core314.com</a>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <Building2 className="h-5 w-5 text-sky-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Based in</p>
                  <p className="text-sm font-medium text-slate-900">United States</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
