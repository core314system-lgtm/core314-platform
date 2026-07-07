import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Shield, Lock, Server, Database,
  CheckCircle, ArrowRight, FileText,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const securityLayers = [
  {
    icon: Lock,
    title: 'Encryption',
    items: [
      'AES-256 encryption for all data at rest',
      'TLS 1.3 for all data in transit',
      'Database-level encryption via Supabase enterprise infrastructure',
      'Encrypted backups with point-in-time recovery',
    ],
  },
  {
    icon: Shield,
    title: 'Access Control',
    items: [
      'Row-level security (RLS) enforced at database layer — complete tenant isolation',
      'Role-based access control (RBAC) within organizations',
      'JWT-based authentication with secure session management',
      'Multi-factor authentication (TOTP) for all accounts',
      'SAML 2.0 SSO — enterprise customers sign in via Okta, Azure AD, Google Workspace, or any SAML-compatible IdP',
    ],
  },
  {
    icon: Server,
    title: 'AI Processing',
    items: [
      'All AI calls processed server-side via Netlify Functions — no API keys in browser',
      'Document content never exposed to client-side code',
      'AI model outputs stored in your isolated tenant — never shared or used for training',
      'Rate limiting on all API endpoints to prevent abuse',
    ],
  },
  {
    icon: Database,
    title: 'Data Management',
    items: [
      'Automated daily backups with 30-day retention',
      'Point-in-time recovery capability',
      'Customer data exported on demand (CSV, JSON, PDF)',
      'Complete data deletion within 30 days of account closure',
    ],
  },
]

const compliance = [
  { label: 'SOC 2 Type II', desc: 'Built on SOC 2 Type II certified infrastructure (Supabase). Application-level controls align with SOC 2 trust service criteria.', status: 'Infrastructure Certified' },
  { label: 'GDPR', desc: 'Data processing aligned with EU General Data Protection Regulation requirements', status: 'Compliant' },
  { label: 'CCPA', desc: 'Consumer privacy rights supported per California Consumer Privacy Act', status: 'Compliant' },
  { label: 'ITAR / CUI', desc: 'Not currently pursued. Architecture designed to support controlled unclassified information workflows. Full CUI controls available upon enterprise customer requirement.', status: 'Not Pursued' },
  { label: 'FedRAMP Authorization', desc: 'Not currently pursued. The platform can support future deployment within a FedRAMP-authorized environment if customer demand requires it.', status: 'Not Pursued' },
  { label: 'HIPAA', desc: 'Platform can be configured for HIPAA-compliant use cases with BAA', status: 'On Request' },
]

const dataHandling = [
  { title: 'What Procuvex Processes', items: [
    'Publicly available SAM.gov opportunity data and entity registrations',
    'RFP/SOW documents you upload for AI analysis (stored in your isolated tenant)',
    'Your past performance citations, compliance matrices, and capture data',
    'Subcontractor profiles sourced from public SAM.gov registrations',
    'Your team\'s project management data (tasks, gates, timelines)',
  ]},
  { title: 'What Procuvex Does NOT Handle', items: [
    'Classified or Secret-level information (no facility clearance)',
    'Controlled Unclassified Information (CUI) unless enterprise CUI controls are activated',
    'Payment card data (handled entirely by Stripe PCI DSS Level 1)',
    'Government network credentials or CAC/PIV authentication',
    'Source selection sensitive information or pre-decisional data',
  ]},
]

const practices = [
  'Input sanitization and XSS prevention on all user inputs',
  'CSRF protection on all authenticated endpoints',
  'SQL injection prevention via parameterized queries and ORM',
  'Rate limiting across all public and authenticated API endpoints',
  'Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)',
  'Dependency vulnerability scanning and automated updates',
  'Secure error handling — no internal details exposed to clients',
  'Audit logging for administrative actions',
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-6">
              <Shield className="w-3.5 h-3.5" />
              Security Posture
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
              Enterprise Security for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Sensitive Procurement Data
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">
              Government contractors handle sensitive bid documents, pricing data, and compliance records. 
              Procuvex is engineered from the ground up with security as a core requirement — not an afterthought.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg transition-all"
              >
                Request Security Documentation
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/sla"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-300 border border-slate-600 rounded-xl hover:border-slate-500 transition-all"
              >
                <FileText className="w-4 h-4" />
                View SLA
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Security Layers */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              Defense in Depth
            </motion.h2>
            <div className="space-y-6">
              {securityLayers.map(layer => (
                <motion.div key={layer.title} variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <layer.icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{layer.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {layer.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Compliance */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              Compliance & Certifications
            </motion.h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {compliance.map(c => (
                <motion.div key={c.label} variants={fadeUp} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-900">{c.label}</h4>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c.status === 'Compliant' || c.status === 'Compliant Architecture'
                        ? 'bg-green-50 text-green-700'
                        : c.status === 'Ready' || c.status === 'Capable'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{c.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Data Handling Transparency */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-4 text-center">
              Data Handling Transparency
            </motion.h2>
            <motion.p variants={fadeUp} className="text-sm text-slate-500 text-center mb-10 max-w-2xl mx-auto">
              Government contractors need to know exactly what data touches our platform. Here is a clear breakdown of what Procuvex processes and what it does not.
            </motion.p>
            <div className="grid sm:grid-cols-2 gap-6">
              {dataHandling.map(section => (
                <motion.div key={section.title} variants={fadeUp} className="bg-white rounded-xl border border-slate-200 p-6">
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    {section.title.includes('NOT') ? (
                      <Shield className="w-4 h-4 text-red-500" />
                    ) : (
                      <Database className="w-4 h-4 text-blue-500" />
                    )}
                    {section.title}
                  </h4>
                  <ul className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          section.title.includes('NOT') ? 'text-slate-400' : 'text-green-500'
                        }`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Security Practices */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              Application Security Practices
            </motion.h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {practices.map(practice => (
                <motion.div key={practice} variants={fadeUp} className="flex items-start gap-3 bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{practice}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold mb-4">
              Need More Details?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 max-w-lg mx-auto mb-8">
              We provide comprehensive security documentation, penetration test reports, and compliance 
              attestations to enterprise customers upon request.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg transition-all"
              >
                Request Security Package
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/dpa"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-300 border border-slate-600 rounded-xl hover:border-slate-500 transition-all"
              >
                View DPA
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
