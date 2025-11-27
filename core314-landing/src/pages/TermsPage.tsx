import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';

export default function TermsPage() {
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
            Terms of Service
          </h1>

          <div className="prose prose-invert prose-cyan max-w-none space-y-6 text-gray-300" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-gray-400">Last Updated: November 8, 2025</p>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. Acceptance of Terms</h2>
              <p>
                By accessing and using Core314's services, you accept and agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. Use of Services</h2>
              <p>
                You agree to use Core314's services only for lawful purposes and in accordance with these Terms. 
                You are responsible for maintaining the confidentiality of your account credentials.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Intellectual Property</h2>
              <p>
                All content, features, and functionality of Core314's services are owned by Core314 and are 
                protected by international copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Limitation of Liability</h2>
              <p>
                Core314 shall not be liable for any indirect, incidental, special, consequential, or punitive 
                damages resulting from your use of or inability to use the services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Modifications</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of any material 
                changes via email or through our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. Contact Information</h2>
              <p>
                For questions about these Terms, please{' '}
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
