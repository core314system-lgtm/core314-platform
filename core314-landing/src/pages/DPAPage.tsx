import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';

export default function DPAPage() {
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
            Data Processing Addendum
          </h1>

          <div className="prose prose-slate max-w-none space-y-6 text-slate-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p className="text-sm text-slate-500">Last Updated: November 8, 2025</p>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>1. Definitions</h2>
              <p>
                This Data Processing Addendum ("DPA") forms part of the agreement between you ("Customer") and 
                Core314 ("Processor") for the provision of services. Terms used in this DPA have the meanings 
                set forth in applicable data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>2. Scope and Applicability</h2>
              <p>
                This DPA applies to the processing of Personal Data by Core314 on behalf of Customer in connection 
                with the services provided under the main agreement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>3. Data Processing</h2>
              <p>
                Core314 shall process Personal Data only on documented instructions from Customer, unless required 
                to do so by applicable law. Core314 shall ensure that persons authorized to process Personal Data 
                are subject to confidentiality obligations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>4. Security Measures</h2>
              <p>
                Core314 implements appropriate technical and organizational measures to ensure a level of security 
                appropriate to the risk, including encryption, access controls, and regular security assessments.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>5. Sub-Processors</h2>
              <p>
                Customer authorizes Core314 to engage sub-processors to process Personal Data. Core314 shall 
                ensure that sub-processors are bound by data protection obligations equivalent to those in this DPA.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>6. Data Subject Rights</h2>
              <p>
                Core314 shall assist Customer in responding to requests from data subjects exercising their rights 
                under applicable data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>7. Data Breach Notification</h2>
              <p>
                Core314 shall notify Customer without undue delay upon becoming aware of a Personal Data breach 
                affecting Customer's data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>8. Deletion and Return of Data</h2>
              <p>
                Upon termination of services, Core314 shall delete or return all Personal Data to Customer, unless 
                retention is required by applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>9. Audits</h2>
              <p>
                Core314 shall make available to Customer information necessary to demonstrate compliance with this 
                DPA and allow for audits by Customer or an authorized auditor.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>10. Contact</h2>
              <p>
                For questions regarding data processing, please{' '}
                <Link to="/contact" className="text-sky-600 hover:text-sky-700 underline">
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
