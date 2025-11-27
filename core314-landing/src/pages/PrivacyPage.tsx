import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>

          <div className="prose prose-invert prose-cyan max-w-none space-y-6 text-gray-300" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-gray-400">Last Updated: November 8, 2025</p>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. Information We Collect</h2>
              <p>
                Core314 collects information that you provide directly to us, including name, email address, 
                company information, and any other information you choose to provide when using our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. How We Use Your Information</h2>
              <p>
                We use the information we collect to provide, maintain, and improve our services, to communicate 
                with you, and to comply with legal obligations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Data Security</h2>
              <p>
                We implement appropriate technical and organizational measures to protect your personal information 
                against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to fulfill the purposes outlined in 
                this Privacy Policy, unless a longer retention period is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Your Rights</h2>
              <p>
                You have the right to access, correct, or delete your personal information. You may also object 
                to or restrict certain processing of your data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#00BFFF] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us through our{' '}
                <Link to="/contact" className="text-[#00BFFF] hover:text-[#66FCF1] underline">
                  contact form
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
