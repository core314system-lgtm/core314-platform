import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Footer from '../components/Footer'

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Back to Home
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm">
          <h1 className="text-4xl font-bold mb-8 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Cookie Policy</h1>

          <div className="prose prose-slate max-w-none space-y-6 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-slate-500">Last Updated: May 14, 2026</p>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. What Are Cookies</h2>
              <p>Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our services.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. Types of Cookies We Use</h2>
              <p><strong className="text-blue-600">Essential Cookies:</strong> Required for the website and application to function properly, including authentication tokens and session management.</p>
              <p className="mt-3"><strong className="text-blue-600">Analytics Cookies:</strong> Help us understand how visitors interact with our website so we can improve the experience.</p>
              <p className="mt-3"><strong className="text-blue-600">Functional Cookies:</strong> Enable enhanced functionality and personalization, such as remembering your preferences and organization settings.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Managing Cookies</h2>
              <p>You can control and manage cookies through your browser settings. Please note that removing or blocking cookies may affect the functionality of the Procuvex platform, particularly authentication and session management features.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Third-Party Cookies</h2>
              <p>We may use third-party analytics services that set their own cookies. These services help us understand usage patterns and improve our platform. We do not allow third-party advertising cookies.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Contact</h2>
              <p>If you have questions about our use of cookies, please contact us at <a href="mailto:support@govmatchai.com" className="text-blue-600 hover:text-blue-700">support@govmatchai.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
