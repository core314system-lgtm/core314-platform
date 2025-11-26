import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';

export default function CookiesPage() {
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

        <div className="bg-gradient-to-br from-[#001a33] to-[#0A0F1A] border border-[#00BFFF]/30 rounded-2xl p-8 md:p-12">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#00BFFF] to-[#66FCF1] bg-clip-text text-transparent" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Cookie Policy
          </h1>

          <div className="prose prose-invert prose-cyan max-w-none space-y-6 text-gray-300" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-gray-400">Last Updated: November 8, 2025</p>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. What Are Cookies</h2>
              <p>
                Cookies are small text files that are placed on your device when you visit our website. They help 
                us provide you with a better experience by remembering your preferences and understanding how you 
                use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. Types of Cookies We Use</h2>
              <p>
                <strong className="text-[#00BFFF]">Essential Cookies:</strong> Required for the website to function properly.
              </p>
              <p>
                <strong className="text-[#00BFFF]">Analytics Cookies:</strong> Help us understand how visitors interact with our website.
              </p>
              <p>
                <strong className="text-[#00BFFF]">Functional Cookies:</strong> Enable enhanced functionality and personalization.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Managing Cookies</h2>
              <p>
                You can control and manage cookies through your browser settings. Please note that removing or 
                blocking cookies may impact your user experience and some features may not function properly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Third-Party Cookies</h2>
              <p>
                We may use third-party services that set cookies on your device. These third parties have their 
                own privacy policies and cookie policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Updates to This Policy</h2>
              <p>
                We may update this Cookie Policy from time to time. Any changes will be posted on this page with 
                an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. Contact Us</h2>
              <p>
                If you have questions about our use of cookies, please{' '}
                <Link to="/contact" className="text-[#00BFFF] hover:text-[#66FCF1] underline">
                  contact us
                </Link>.
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
