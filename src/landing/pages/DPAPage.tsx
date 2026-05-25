import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Footer from '../components/Footer'

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Back to Home
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm">
          <h1 className="text-4xl font-bold mb-8 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Data Processing Addendum</h1>

          <div className="prose prose-slate max-w-none space-y-6 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-slate-500">Last Updated: May 14, 2026</p>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. Definitions</h2>
              <p>This Data Processing Addendum ("DPA") forms part of the agreement between you ("Customer") and Core314&trade; Technologies LLC ("Processor") for the provision of the Procuvex platform and related services. Terms used in this DPA have the meanings set forth in applicable data protection laws.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. Scope and Applicability</h2>
              <p>This DPA applies to the processing of Personal Data by Core314 on behalf of Customer in connection with the Procuvex platform. Personal Data may include names, email addresses, and business contact information of Customer's team members, subcontractors, and contacts referenced in uploaded documents.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Data Processing</h2>
              <p>Core314 shall process Personal Data only on documented instructions from Customer, unless required to do so by applicable law. Core314 shall ensure that persons authorized to process Personal Data are subject to confidentiality obligations.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Security Measures</h2>
              <p>Core314 implements appropriate technical and organizational measures to protect Personal Data, including:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Row-level security for organizational data isolation</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Regular security assessments and monitoring</li>
                <li>Server-side processing of sensitive operations (AI analysis, API key management)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Sub-Processors</h2>
              <p>Customer authorizes Core314 to engage the following sub-processors:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Supabase, Inc.</strong> — Database hosting and authentication (United States)</li>
                <li><strong>OpenAI, LLC</strong> — AI document analysis processing (United States)</li>
                <li><strong>Twilio/SendGrid</strong> — Email delivery services (United States)</li>
                <li><strong>Netlify, Inc.</strong> — Application hosting (United States)</li>
              </ul>
              <p className="mt-4">Core314 will notify Customer of any changes to sub-processors and ensure all sub-processors are bound by data protection obligations no less protective than those in this DPA.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. Data Breach Notification</h2>
              <p>Core314 shall notify Customer without undue delay upon becoming aware of a Personal Data breach. Notification shall include the nature of the breach, categories of data affected, likely consequences, and measures taken to address the breach.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>7. Data Deletion</h2>
              <p>Upon termination of the agreement, Core314 shall delete all Personal Data within 30 days unless retention is required by applicable law. Customer may request data export in a standard format prior to termination.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>8. Contact</h2>
              <p>For questions about this DPA, contact us at <a href="mailto:support@procuvex.com" className="text-blue-600 hover:text-blue-700">support@procuvex.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
