import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, Clock, CheckCircle } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function SLAPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-16 pt-28">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-8 transition-colors">
          <ArrowLeft className="h-5 w-5" /> Back to Home
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm">
          <h1 className="text-4xl font-bold mb-2 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Service Level Agreement
          </h1>
          <p className="text-sm text-slate-500 mb-8">Effective: May 14, 2026 &middot; Core314 Technologies LLC</p>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>

            {/* Overview cards */}
            <div className="grid sm:grid-cols-3 gap-4 not-prose">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
                <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">99.9%</div>
                <div className="text-xs text-slate-600">Uptime Guarantee</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                <Clock className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">&lt; 4 hrs</div>
                <div className="text-xs text-slate-600">Critical Response Time</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                <CheckCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-900">24/7</div>
                <div className="text-xs text-slate-600">System Monitoring</div>
              </div>
            </div>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                1. Service Availability
              </h2>
              <p>
                Core314 Technologies LLC (&quot;Core314&quot;) commits to maintaining the Procuvex platform with a monthly 
                uptime of <strong>99.9%</strong> (&quot;Uptime Commitment&quot;). This equates to no more than 43 minutes 
                of unplanned downtime per month.
              </p>
              <p className="mt-4">
                Uptime is calculated as: <code className="bg-slate-100 px-2 py-1 rounded text-sm">(Total Minutes - Downtime Minutes) / Total Minutes × 100</code>
              </p>
              <p className="mt-4">
                <strong>Excluded from downtime calculations:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Scheduled maintenance (communicated at least 48 hours in advance)</li>
                <li>Force majeure events (natural disasters, war, government actions)</li>
                <li>Third-party service outages beyond our control (cloud infrastructure, DNS, CDN)</li>
                <li>Customer-caused issues (misconfiguration, excessive API usage beyond rate limits)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                2. Support Response Times
              </h2>
              <div className="not-prose overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 pr-4 text-sm font-semibold text-slate-900">Severity</th>
                      <th className="text-left py-3 pr-4 text-sm font-semibold text-slate-900">Description</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-blue-600">Growth</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-900">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-600">
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-red-600">Critical</td>
                      <td className="py-3 pr-4">Platform unavailable, data loss risk, security incident</td>
                      <td className="py-3 px-4 text-center">4 hours</td>
                      <td className="py-3 px-4 text-center font-semibold">1 hour</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-amber-600">High</td>
                      <td className="py-3 pr-4">Major feature unavailable, significant performance degradation</td>
                      <td className="py-3 px-4 text-center">8 hours</td>
                      <td className="py-3 px-4 text-center font-semibold">4 hours</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-blue-600">Medium</td>
                      <td className="py-3 pr-4">Minor feature issue, workaround available</td>
                      <td className="py-3 px-4 text-center">24 hours</td>
                      <td className="py-3 px-4 text-center font-semibold">8 hours</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-slate-500">Low</td>
                      <td className="py-3 pr-4">General questions, feature requests, non-urgent issues</td>
                      <td className="py-3 px-4 text-center">48 hours</td>
                      <td className="py-3 px-4 text-center font-semibold">24 hours</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm">
                Response times are measured during business hours (Monday–Friday, 8 AM–6 PM EST) for Growth 
                tier, and 24/7 for Enterprise tier critical/high severity issues.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                3. Service Credits
              </h2>
              <p>
                If Core314 fails to meet the 99.9% Uptime Commitment in any calendar month, eligible customers 
                may request service credits as follows:
              </p>
              <div className="not-prose overflow-x-auto mt-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 pr-4 text-sm font-semibold text-slate-900">Monthly Uptime</th>
                      <th className="text-left py-3 pr-4 text-sm font-semibold text-slate-900">Service Credit</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-600">
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">99.0% – 99.9%</td>
                      <td className="py-3 pr-4">10% of monthly subscription fee</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">95.0% – 99.0%</td>
                      <td className="py-3 pr-4">25% of monthly subscription fee</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">Below 95.0%</td>
                      <td className="py-3 pr-4">50% of monthly subscription fee</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm">
                Service credits must be requested within 30 days of the end of the affected month. Credits 
                are applied to future invoices and do not exceed the monthly subscription fee. Service credits 
                are the sole and exclusive remedy for failure to meet the Uptime Commitment.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                4. Data Protection & Backup
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Automated backups:</strong> Database backups run every 24 hours with point-in-time recovery capability</li>
                <li><strong>Data retention:</strong> Customer data is retained for the duration of the subscription plus 30 days after cancellation</li>
                <li><strong>Data export:</strong> Customers may export their data at any time through the platform&apos;s export functionality (CSV, JSON, PDF)</li>
                <li><strong>Data deletion:</strong> Upon request, all customer data is permanently deleted within 30 days of account closure</li>
                <li><strong>Encryption:</strong> All data encrypted at rest (AES-256) and in transit (TLS 1.3)</li>
                <li><strong>Isolation:</strong> Row-level security (RLS) ensures complete tenant isolation — no organization can access another&apos;s data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                5. Scheduled Maintenance
              </h2>
              <p>
                Scheduled maintenance windows are communicated at least <strong>48 hours in advance</strong> via email to 
                all registered account administrators. Maintenance is typically performed during low-usage periods 
                (Saturday 2 AM – 6 AM EST).
              </p>
              <p className="mt-4">
                Emergency maintenance (security patches, critical bug fixes) may be performed with less notice, 
                but affected customers will be notified as soon as practicable.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                6. Support Channels
              </h2>
              <div className="not-prose overflow-x-auto mt-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 pr-4 text-sm font-semibold text-slate-900">Channel</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-blue-600">Growth</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-900">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-600">
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">Email support</td>
                      <td className="py-3 px-4 text-center"><CheckCircle className="w-4 h-4 text-green-500 inline" /></td>
                      <td className="py-3 px-4 text-center"><CheckCircle className="w-4 h-4 text-green-500 inline" /></td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">In-app AI assistant</td>
                      <td className="py-3 px-4 text-center"><CheckCircle className="w-4 h-4 text-green-500 inline" /></td>
                      <td className="py-3 px-4 text-center"><CheckCircle className="w-4 h-4 text-green-500 inline" /></td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">Priority queue</td>
                      <td className="py-3 px-4 text-center text-slate-400">—</td>
                      <td className="py-3 px-4 text-center"><CheckCircle className="w-4 h-4 text-green-500 inline" /></td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">Dedicated onboarding</td>
                      <td className="py-3 px-4 text-center text-slate-400">—</td>
                      <td className="py-3 px-4 text-center"><CheckCircle className="w-4 h-4 text-green-500 inline" /></td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4">Phone support</td>
                      <td className="py-3 px-4 text-center text-slate-400">—</td>
                      <td className="py-3 px-4 text-center"><CheckCircle className="w-4 h-4 text-green-500 inline" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                7. Modifications
              </h2>
              <p>
                Core314 may update this SLA from time to time. Changes will be communicated via email to all 
                registered administrators at least 30 days before taking effect. Continued use of the platform 
                after the effective date constitutes acceptance of the updated SLA.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                8. Contact
              </h2>
              <p>
                For SLA-related inquiries, service credit requests, or to report an outage:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Email: <a href="mailto:support@core314.com" className="text-blue-600 hover:underline">support@core314.com</a></li>
                <li>Status page: <a href="/status" className="text-blue-400 hover:text-blue-300 underline">status.procuvex.com</a></li>
              </ul>
            </section>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
