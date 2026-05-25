import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Footer from '../components/Footer'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Back to Home
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm">
          <h1 className="text-4xl font-bold mb-8 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Privacy Policy</h1>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-slate-500">Last Updated: May 14, 2026</p>

            <p className="text-lg">
              Core314&trade; Technologies LLC ("Core314," "we," "us," or "our") is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you
              use the Procuvex&trade; platform and related services.
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. Information We Collect</h2>

              <h3 className="text-lg font-semibold text-slate-800 mb-2">Account Information</h3>
              <p>When you create an account, we collect information such as your name, email address, company name, and billing information necessary to provide our services.</p>

              <h3 className="text-lg font-semibold text-slate-800 mb-2 mt-4">Documents and Project Data</h3>
              <p>When you upload documents (SOWs, pricing sheets, amendments, etc.) and create projects, we store this content securely to provide analysis and management features. Documents are associated with your organization and subject to row-level security.</p>

              <h3 className="text-lg font-semibold text-slate-800 mb-2 mt-4">AI-Processed Data</h3>
              <p>When you run AI analysis on documents, the content is sent to our AI processing pipeline to extract requirements, generate compliance matrices, and produce other outputs. These outputs are stored in your organization's account.</p>

              <h3 className="text-lg font-semibold text-slate-800 mb-2 mt-4">Usage Information</h3>
              <p>We collect information about how you use the platform, including pages visited, features used, and actions taken. This helps us improve the service and provide support.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Provide, maintain, and improve the Procuvex platform</li>
                <li>Process documents and generate AI-powered analysis</li>
                <li>Manage your account, organization, and team</li>
                <li>Send service-related communications (invitations, notifications)</li>
                <li>Respond to customer support requests</li>
                <li>Analyze usage patterns to improve features</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Third-Party Services</h2>
              <p>Procuvex uses the following third-party services to deliver its functionality:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Supabase</strong> — Database hosting, authentication, and file storage</li>
                <li><strong>OpenAI</strong> — AI document analysis and natural language processing (server-side only)</li>
                <li><strong>SendGrid</strong> — Transactional email delivery (invitations, notifications)</li>
                <li><strong>Netlify</strong> — Application hosting and serverless functions</li>
                <li><strong>SAM.gov</strong> — Federal opportunity data (public API, no personal data shared)</li>
              </ul>
              <p className="mt-4">We do not sell your personal information or document data to any third party. AI providers process your documents for analysis purposes only and do not retain or train on your data.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Data Security</h2>
              <p>We implement industry-standard security measures including:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Encryption in transit (TLS 1.3) and at rest (AES-256)</li>
                <li>Row-level security ensuring organizational data isolation</li>
                <li>Server-side API key management (no secrets in browser)</li>
                <li>Role-based access control within organizations</li>
                <li>Regular security monitoring and updates</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Data Retention and Deletion</h2>
              <p>We retain your data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting us at <a href="mailto:support@procuvex.com" className="text-blue-600 hover:text-blue-700">support@procuvex.com</a>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Object to certain processing activities</li>
              </ul>
              <p className="mt-4">To exercise these rights, contact us at <a href="mailto:support@procuvex.com" className="text-blue-600 hover:text-blue-700">support@procuvex.com</a>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>7. Contact Us</h2>
              <p>If you have questions about this Privacy Policy, please contact us:</p>
              <p className="mt-2"><strong>Core314&trade; Technologies LLC</strong><br />Email: <a href="mailto:support@procuvex.com" className="text-blue-600 hover:text-blue-700">support@procuvex.com</a></p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
