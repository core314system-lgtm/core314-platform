import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Footer from '../components/Footer'

export default function AiDataProcessingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Back to Home
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm">
          <h1 className="text-4xl font-bold mb-2 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>AI Data Processing</h1>
          <p className="text-lg text-slate-500 mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>How Procuvex processes your data with AI — transparency documentation for IM3.0 compliance</p>

          <div className="prose prose-slate max-w-none space-y-6 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-slate-500">Last Updated: May 14, 2026</p>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. What Data Is Sent to AI</h2>
              <p>Procuvex uses OpenAI's API to analyze government contract documents. The following data is sent for processing:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Document text content</strong> — Extracted text from uploaded SOWs, pricing sheets, amendments, and other project documents. Documents are parsed client-side and text is sent to the AI engine.</li>
                <li><strong>Project metadata</strong> — Project title, site name, and location (city/state) to provide context for analysis.</li>
                <li><strong>User questions</strong> — When using the AI chat feature, the user's question and relevant project context is sent.</li>
              </ul>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <p className="text-green-800 font-medium">What is NOT sent to AI:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2 text-green-700 text-sm">
                  <li>User credentials, passwords, or authentication tokens</li>
                  <li>API keys or secret keys</li>
                  <li>Supabase database connection strings</li>
                  <li>Payment or billing information</li>
                  <li>Raw file uploads (only extracted text is sent)</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. AI Service Provider</h2>
              <p>Procuvex uses <strong>OpenAI's API</strong> (models: GPT-4o-mini) for document analysis. OpenAI is a US-based AI company with the following certifications and commitments:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>SOC 2 Type 2 certified</strong> — Independently audited security, availability, and confidentiality controls</li>
                <li><strong>No training on API data</strong> — OpenAI does not use data sent via their API for model training. Per their <a href="https://openai.com/enterprise-privacy" target="_blank" rel="noreferrer" className="text-blue-600 underline">Enterprise Privacy</a> commitment, API data is not used to improve their models.</li>
                <li><strong>Data retention</strong> — API inputs and outputs are retained for up to 30 days for abuse and misuse monitoring, then permanently deleted. Zero-data-retention (ZDR) endpoints are available upon request.</li>
                <li><strong>Sub-processors</strong> — OpenAI uses Microsoft Azure as their primary cloud infrastructure provider. Data centers are located in the United States.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Data Flow Architecture</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 my-4">
                <div className="space-y-4 text-sm font-mono">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-xs">1</div>
                    <div>User uploads document to Procuvex → Stored in <strong>Supabase Storage</strong> (encrypted at rest, AES-256)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-xs">2</div>
                    <div>User triggers AI analysis → Client-side parser extracts text from document</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-xs">3</div>
                    <div>Extracted text sent to <strong>Netlify serverless function</strong> (ai-proxy) via HTTPS/TLS 1.2+</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-xs">4</div>
                    <div>Serverless function forwards sanitized text to <strong>OpenAI API</strong> via HTTPS/TLS 1.2+</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-xs">5</div>
                    <div>OpenAI returns structured analysis → Response stored in <strong>Supabase DB</strong> (never stored by OpenAI permanently)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 text-green-700 rounded-lg flex items-center justify-center font-bold text-xs">6</div>
                    <div>Every AI call logged to <strong>AI Audit Log</strong> — timestamp, tokens, model, latency, status</div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Encryption & Security</h2>
              <table className="w-full border-collapse text-sm mt-2">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-2 pr-4 font-semibold text-slate-900">Layer</th>
                    <th className="text-left py-2 pr-4 font-semibold text-slate-900">Protection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2 pr-4 font-medium">In Transit</td><td className="py-2">TLS 1.2+ encryption for all API calls (browser → Netlify → OpenAI)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">At Rest (Storage)</td><td className="py-2">AES-256 encryption in Supabase Storage (AWS S3 backend)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">At Rest (Database)</td><td className="py-2">AES-256 encryption in Supabase PostgreSQL (AWS RDS)</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">API Keys</td><td className="py-2">Stored as server-side environment variables; never exposed to client code</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">Access Control</td><td className="py-2">Row Level Security (RLS) on all database tables; JWT-based authentication</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">Input Sanitization</td><td className="py-2">All AI inputs sanitized to prevent prompt injection of HTML/scripts</td></tr>
                  <tr><td className="py-2 pr-4 font-medium">Rate Limiting</td><td className="py-2">Per-organization rate limiting on AI calls to prevent abuse</td></tr>
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. PII Detection</h2>
              <p>Procuvex includes built-in PII (Personally Identifiable Information) detection that scans documents before AI analysis. If potential PII is detected (Social Security Numbers, bulk email addresses, credit card numbers, etc.), the user is shown a warning with the option to:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Proceed</strong> — Continue with AI analysis, acknowledging PII will be transmitted</li>
                <li><strong>Cancel</strong> — Stop the AI analysis and review/redact the document first</li>
              </ul>
              <p className="mt-4">All PII detection is performed client-side using pattern matching. No PII data is sent externally for the detection itself.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. Audit Trail</h2>
              <p>Every AI interaction is logged in Procuvex's AI Audit Log, accessible to account administrators. Each log entry records:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Timestamp of the AI call</li>
                <li>User who initiated the request</li>
                <li>Type of AI operation (document analysis, compliance matrix, Q&A matching, chat, etc.)</li>
                <li>Model used (e.g., GPT-4o-mini)</li>
                <li>Token consumption (prompt + completion tokens)</li>
                <li>Response latency</li>
                <li>Success/failure status</li>
                <li>Project context (which project and documents were analyzed)</li>
              </ul>
              <p className="mt-4">The audit log can be exported as CSV for compliance review. This satisfies IM3.0 Section E.6 monitoring requirements.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>7. Human Oversight</h2>
              <p>All AI outputs in Procuvex are <strong>advisory only</strong>. No AI-generated content is used for autonomous decision-making. Specifically:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>AI document analysis requires human review before use in proposals</li>
                <li>AI-generated compliance matrices are flagged for human verification</li>
                <li>AI Q&A matching requires admin approval before distribution to subcontractors</li>
                <li>AI chat responses are informational only — no automated actions</li>
                <li>Bid decision recommendations are advisory with explicit confidence scores</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>8. Data Deletion</h2>
              <p>Users can request deletion of their data at any time through the Settings page ("Export & Delete My Data"). Upon deletion:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>All stored documents are removed from Supabase Storage</li>
                <li>All AI analysis outputs are deleted from the database</li>
                <li>AI Audit Log entries are retained for compliance purposes (metadata only, no document content)</li>
                <li>OpenAI's 30-day API data retention applies to previously processed requests</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>9. Contact</h2>
              <p>For questions about AI data processing, data deletion requests, or compliance inquiries, contact us through our <Link to="/contact" className="text-blue-600 underline">contact form</Link>.</p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
