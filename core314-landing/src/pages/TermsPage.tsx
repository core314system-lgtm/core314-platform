import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 mb-8 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 shadow-sm">
                    <h1 className="text-4xl font-bold mb-8 text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Terms of Service
                    </h1>

                    <div className="prose prose-slate max-w-none space-y-8 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <p className="text-sm text-slate-500">Last Updated: January 7, 2026</p>
                      <p className="text-xs text-slate-400">Patent Pending</p>

            <p className="text-lg">
                            These Terms of Service ("Terms") govern your access to and use of the Core314™ platform and services 
                            provided by Core314™ Technologies LLC ("Core314," "we," "us," or "our").By accessing or using our 
              services, you agree to be bound by these Terms.
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. Acceptance of Terms</h2>
              <p>
                By accessing, browsing, or using the Core314 platform, you acknowledge that you have read, understood, 
                and agree to be bound by these Terms. If you are using the services on behalf of an organization, you 
                represent and warrant that you have the authority to bind that organization to these Terms.
              </p>
              <p className="mt-4">
                If you do not agree to these Terms, you must not access or use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. Description of Service</h2>
              <p>
                Core314 provides a system intelligence platform that connects to your business systems, observes 
                operational patterns, and generates analytical insights. The platform is designed to help organizations 
                understand their operational behavior and identify patterns, variance, and potential issues.
              </p>
              <p className="mt-4 font-semibold">
                Core314 is NOT a decision-making authority. The platform provides intelligence, insights, and 
                observations to support your decision-making processes. All decisions and actions remain your 
                sole responsibility.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. No Professional Advice</h2>
              <p>
                The information, insights, and outputs provided by Core314 are for informational purposes only and 
                do not constitute legal, financial, operational, medical, or other professional advice. You should 
                consult with qualified professionals before making any decisions based on information provided by 
                the platform.
              </p>
              <p className="mt-4">
                Core314 does not provide recommendations or advice regarding specific business decisions, investments, 
                personnel matters, or any other professional domain.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. No Warranties</h2>
              <p className="font-semibold uppercase">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS 
                OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
                PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
              </p>
              <p className="mt-4">
                Core314 does not warrant that:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>The service will meet your specific requirements or expectations</li>
                <li>The service will be uninterrupted, timely, secure, or error-free</li>
                <li>The results, insights, or outputs obtained from the service will be accurate, complete, or reliable</li>
                <li>Any errors in the service will be corrected</li>
              </ul>
              <p className="mt-4">
                You acknowledge that any reliance on the service or its outputs is at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Limitation of Liability</h2>
              <p className="font-semibold uppercase">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CORE314 AND ITS OFFICERS, DIRECTORS, EMPLOYEES, 
                AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, 
                PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, 
                USE, DATA, OR OTHER INTANGIBLE LOSSES, REGARDLESS OF WHETHER CORE314 HAS BEEN ADVISED OF THE 
                POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p className="mt-4">
                In no event shall Core314's aggregate liability for all claims arising out of or relating to these 
                Terms or the service exceed the total amount of fees paid by you to Core314 during the twelve (12) 
                months immediately preceding the event giving rise to the claim.
              </p>
              <p className="mt-4">
                Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the 
                above limitations may not apply to you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. User Responsibilities</h2>
              <p>You agree to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>Use the service only for lawful purposes and in compliance with all applicable laws and regulations</li>
                <li>Maintain the confidentiality and security of your account credentials</li>
                <li>Promptly notify Core314 of any unauthorized access to your account</li>
                <li>Not attempt to reverse engineer, decompile, or disassemble any part of the service</li>
                <li>Not interfere with or disrupt the integrity or performance of the service</li>
                <li>Not use the service to transmit malicious code or engage in harmful activities</li>
                <li>Not use the service in any manner that could damage, disable, or impair the service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>7. Subscriptions and Payment</h2>
              <p>
                Access to certain features of the service requires a paid subscription. By subscribing, you agree 
                to pay all applicable fees as described on our pricing page. Subscription fees are billed in advance 
                on a recurring basis (monthly or annually, as selected).
              </p>
              <p className="mt-4">
                Subscriptions automatically renew unless cancelled before the renewal date. You may cancel your 
                subscription at any time through your account settings or by contacting support.
              </p>
              <p className="mt-4">
                Core314 reserves the right to modify pricing with reasonable notice. Continued use of the service 
                after a price change constitutes acceptance of the new pricing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>8. Termination and Suspension</h2>
              <p>
                Core314 may suspend or terminate your access to the service at any time, with or without cause, 
                and with or without notice. Reasons for termination may include, but are not limited to:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>Violation of these Terms</li>
                <li>Non-payment of fees</li>
                <li>Conduct that Core314 believes is harmful to other users or the service</li>
                <li>Requests by law enforcement or government agencies</li>
              </ul>
              <p className="mt-4">
                Upon termination, your right to use the service will immediately cease. Core314 is not liable to 
                you or any third party for any termination of your access to the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>9. Intellectual Property</h2>
              <p>
                The Core314 platform, including all software, algorithms, designs, text, graphics, logos, and other 
                content, is the exclusive property of Core314 Technologies LLC and is protected by copyright, 
                trademark, and other intellectual property laws.
              </p>
              <p className="mt-4">
                You retain ownership of all data you provide to the service. By using the service, you grant Core314 
                a limited license to process your data solely for the purpose of providing the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>10. Governing Law and Jurisdiction</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United States 
                and the State of Delaware, without regard to its conflict of law provisions.
              </p>
              <p className="mt-4">
                Any disputes arising out of or relating to these Terms or the service shall be resolved exclusively 
                in the state or federal courts located in Delaware, and you consent to the personal jurisdiction 
                of such courts.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>11. Modifications to Terms</h2>
              <p>
                Core314 reserves the right to modify these Terms at any time. We will notify you of material changes 
                by posting the updated Terms on our website and updating the "Last Updated" date. Your continued 
                use of the service after such changes constitutes acceptance of the modified Terms.
              </p>
              <p className="mt-4">
                It is your responsibility to review these Terms periodically for changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>12. Contact Information</h2>
              <p>
                If you have questions about these Terms of Service, please contact us at:
              </p>
              <p className="mt-4">
                <strong>Core314 Technologies LLC</strong><br />
                Email:{' '}
                <a href="mailto:support@core314.com" className="text-sky-600 hover:text-sky-700 underline">
                  support@core314.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
