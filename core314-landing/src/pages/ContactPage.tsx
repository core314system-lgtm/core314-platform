import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Building2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

type InquiryType = 'general' | 'enterprise';

export default function ContactPage() {
  const [inquiryType, setInquiryType] = useState<InquiryType>('general');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/.netlify/functions/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          message: `[${inquiryType === 'enterprise' ? 'Enterprise Inquiry' : 'General Inquiry'}]\n\n${formData.message}`,
        }),
      });

      if (response.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', company: '', phone: '', message: '' });
      } else {
        const data = await response.json();
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
      }
    } catch {
      setErrorMessage('Unable to submit. Please check your connection and try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <Header />
        <section className="pt-28 pb-20 lg:pt-36 lg:pb-28">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Message Received
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Thank you for reaching out. We&apos;ll review your inquiry and respond
              within 2 business days.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Return Home
              </Link>
              <button
                onClick={() => setStatus('idle')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
              >
                Send Another Message
              </button>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-12 lg:pt-36 lg:pb-16 bg-gradient-to-b from-slate-50 to-white">
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

      {/* Inquiry Type Selector + Form */}
      <section className="py-12 lg:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Inquiry Type Tabs */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <button
              type="button"
              onClick={() => setInquiryType('general')}
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                inquiryType === 'general'
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  inquiryType === 'general' ? 'bg-slate-900' : 'bg-slate-100'
                }`}>
                  <Mail className={`h-4 w-4 ${
                    inquiryType === 'general' ? 'text-white' : 'text-slate-500'
                  }`} />
                </div>
                <h3 className="font-semibold text-slate-900">General Inquiry</h3>
              </div>
              <p className="text-xs text-slate-500 ml-12">
                Products, partnerships, media, or general questions
              </p>
            </button>
            <button
              type="button"
              onClick={() => setInquiryType('enterprise')}
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                inquiryType === 'enterprise'
                  ? 'border-sky-600 bg-sky-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  inquiryType === 'enterprise' ? 'bg-sky-600' : 'bg-slate-100'
                }`}>
                  <Building2 className={`h-4 w-4 ${
                    inquiryType === 'enterprise' ? 'text-white' : 'text-slate-500'
                  }`} />
                </div>
                <h3 className="font-semibold text-slate-900">Enterprise Inquiry</h3>
              </div>
              <p className="text-xs text-slate-500 ml-12">
                Custom systems, platform development, or enterprise requirements
              </p>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-slate-900"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-slate-900"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Company / Organization
                </label>
                <input
                  type="text"
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-slate-900"
                  placeholder="Your organization"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-slate-900"
                  placeholder="(optional)"
                />
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors text-slate-900 resize-y"
                placeholder={
                  inquiryType === 'enterprise'
                    ? 'Tell us about your organization, the challenges you face, and what you are looking to achieve...'
                    : 'How can we help?'
                }
              />
            </div>

            {status === 'error' && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white rounded-lg transition-colors ${
                inquiryType === 'enterprise'
                  ? 'bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400'
                  : 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500'
              }`}
            >
              {status === 'submitting' ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {inquiryType === 'enterprise' ? 'Submit Enterprise Inquiry' : 'Send Message'}
                </>
              )}
            </button>
          </form>
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
