import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Send, ArrowLeft, CheckCircle } from 'lucide-react';
import Footer from '../components/Footer';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    formData.append('form-name', 'core314-contact-form');

    const body = new URLSearchParams();
    formData.forEach((value, key) => body.append(key, String(value)));

    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      setSubmitted(true);
      form.reset();
    } catch (err) {
      console.error('Form submit failed', err);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-[#00BFFF] hover:text-[#66FCF1] mb-8 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-2xl p-8 md:p-12"
        >
          <div className="text-center mb-12">
            <h1 
              className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent"
              style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800 }}
            >
              Get in Touch
            </h1>
            <p className="text-gray-400 text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
              Ready to transform your business operations? Let's talk.
            </p>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center py-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mb-6"
              >
                <CheckCircle className="h-24 w-24 text-[#00BFFF] mx-auto" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-[#00BFFF]/10 border border-[#00BFFF]/30 rounded-xl p-8 mb-6"
              >
                <h2 
                  className="text-3xl font-semibold text-[#00BFFF] mb-4"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Thank you for contacting Core314.
                </h2>
                <p className="text-gray-300 text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Our team will reach out shortly with next steps.
                </p>
              </motion.div>
              <Link
                to="/"
                className="inline-block px-8 py-3 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all duration-300"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Return to Home
              </Link>
            </motion.div>
          ) : (
            <form
              name="core314-contact-form"
              method="POST"
              data-netlify="true"
              netlify-honeypot="bot-field"
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              <input type="hidden" name="form-name" value="core314-contact-form" />
              <p className="hidden">
                <label>
                  Don't fill this out if you're human: <input name="bot-field" />
                </label>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Name <span className="text-[#00BFFF]">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:outline-none focus:border-[#00BFFF] transition-colors text-white"
                    placeholder="Your name"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Email <span className="text-[#00BFFF]">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:outline-none focus:border-[#00BFFF] transition-colors text-white"
                    placeholder="your@email.com"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:outline-none focus:border-[#00BFFF] transition-colors text-white"
                    placeholder="(555) 123-4567"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Company
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:outline-none focus:border-[#00BFFF] transition-colors text-white"
                    placeholder="Your company"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Message <span className="text-[#00BFFF]">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#00BFFF]/30 rounded-lg focus:outline-none focus:border-[#00BFFF] transition-colors text-white resize-none"
                  placeholder="Tell us about your needs..."
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
              </div>

              <button
                type="submit"
                className="w-full px-8 py-4 bg-gradient-to-r from-[#00BFFF] to-[#007BFF] rounded-lg font-semibold text-lg hover:shadow-[0_0_30px_rgba(0,191,255,0.6)] transition-all duration-300 flex items-center justify-center gap-2"
                style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
              >
                <Send className="h-5 w-5" />
                Send Message
              </button>
            </form>
          )}
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
