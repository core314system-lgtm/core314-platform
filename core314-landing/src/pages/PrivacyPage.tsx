import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-slate-500">Last Updated: January 7, 2026</p>

            <p className="text-lg">
              Core314 Technologies LLC ("Core314," "we," "us," or "our") is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you 
              use our system intelligence platform and related services.
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. Information We Collect</h2>
              
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Account Information</h3>
              <p>
                When you create an account, we collect information such as your name, email address, company name, 
                job title, and billing information necessary to provide our services.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 mb-2 mt-4">Integration-Related Metadata</h3>
              <p>
                When you connect third-party integrations (such as communication tools, CRM systems, project management 
                platforms, or analytics services), we collect metadata necessary to establish and maintain those connections, 
                including authentication tokens and configuration settings.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 mb-2 mt-4">System Signals and Operational Data</h3>
              <p>
                Core314 observes system behavior and operational patterns from your connected integrations. This includes 
                metrics, events, timestamps, and behavioral signals that enable our system intelligence capabilities. 
                We process this data to identify patterns, establish baselines, and generate insights.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 mb-2 mt-4">Usage Analytics and Logs</h3>
              <p>
                We collect information about how you interact with our platform, including access logs, feature usage, 
                and performance data. This helps us improve our services and troubleshoot issues.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. Observation vs. Ownership</h2>
              <p>
                Core314 observes system behavior to generate intelligence and insights. However, you retain full 
                ownership of your data at all times. We do not claim ownership of any data you provide or that 
                is collected through your connected integrations.
              </p>
              <p className="mt-4">
                <strong>Core314 does not sell customer data.</strong> We do not sell, rent, or trade your personal 
                information or operational data to third parties for their marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Use of Information</h2>
              <p>We use the information we collect for the following purposes:</p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li><strong>Service Operation:</strong> To provide, maintain, and improve our system intelligence platform and related services.</li>
                <li><strong>Intelligence Generation:</strong> To analyze operational patterns, establish baselines, identify variance, and generate insights and recommendations.</li>
                <li><strong>Security and Monitoring:</strong> To detect, prevent, and respond to security incidents, fraud, and other harmful activities.</li>
                <li><strong>Compliance:</strong> To comply with applicable laws, regulations, and legal processes.</li>
                <li><strong>Communication:</strong> To send you service-related communications, updates, and support messages.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Third-Party Services</h2>
              
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Integrations</h3>
              <p>
                Core314 connects with third-party services you authorize, including communication platforms (e.g., Slack, 
                Microsoft Teams), CRM systems (e.g., Salesforce, HubSpot), project management tools (e.g., Jira, Asana), 
                and analytics services. Your use of these integrations is subject to the respective third-party privacy policies.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 mb-2 mt-4">Infrastructure and Service Providers</h3>
              <p>
                We use third-party service providers for hosting, analytics, payment processing, and other operational 
                functions. These providers are contractually obligated to protect your information and may only use it 
                to perform services on our behalf.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Data Security</h2>
              <p>
                We implement reasonable administrative, technical, and organizational safeguards designed to protect 
                your information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Regular security assessments and monitoring</li>
                <li>Employee training on data protection practices</li>
              </ul>
              <p className="mt-4">
                However, no method of transmission over the Internet or electronic storage is completely secure. 
                While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. Data Retention</h2>
              <p>
                We retain your information only as long as necessary to fulfill the purposes outlined in this Privacy Policy, 
                provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. When 
                information is no longer needed, we securely delete or anonymize it.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>7. Your Rights</h2>
              <p>
                Depending on your location, you may have certain rights regarding your personal information, including:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>The right to access your personal information</li>
                <li>The right to correct inaccurate information</li>
                <li>The right to delete your information</li>
                <li>The right to restrict or object to certain processing</li>
                <li>The right to data portability</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:support@core314.com" className="text-sky-600 hover:text-sky-700 underline">
                  support@core314.com
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>8. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices or applicable laws. 
                We will notify you of any material changes by posting the updated policy on our website and updating the 
                "Last Updated" date. Your continued use of our services after such changes constitutes acceptance of the 
                updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>9. Contact Information</h2>
              <p>
                If you have questions about this Privacy Policy or our data practices, please contact us at:
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
