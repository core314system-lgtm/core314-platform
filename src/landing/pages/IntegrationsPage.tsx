import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, Search, Code, Database,
  Globe, FileSpreadsheet, Zap, Clock,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const integrations = [
  {
    icon: Globe,
    title: 'SAM.gov Federal Opportunities',
    status: 'live',
    desc: 'Search active federal contract opportunities directly from Procuvex. Filter by keyword, NAICS code, set-aside type, and opportunity type. Import any result as a new project with details pre-populated.',
    features: [
      'Real-time search of SAM.gov API',
      'Filter by NAICS, set-aside, and opportunity type',
      'One-click import to Procuvex project',
      'Pre-fills solicitation number, agency, deadline, location, and POC',
      'View full opportunity details on SAM.gov',
    ],
  },
  {
    icon: FileSpreadsheet,
    title: 'CSV / Excel Bulk Import',
    status: 'live',
    desc: 'Upload a CSV or Excel file to create multiple projects at once. Procuvex auto-detects column names, shows a preview, then imports all rows as draft projects.',
    features: [
      'Automatic column detection (Title, Solicitation Number, Due Date, etc.)',
      'Preview before import',
      'Supports all 5 project types',
      'Bulk creation of draft projects',
      'Error handling for invalid rows',
    ],
  },
  {
    icon: Code,
    title: 'REST API',
    status: 'live',
    desc: 'Programmatic access to create and list projects. Connect Procuvex to your CRM, ERP, or any system that can make HTTP requests.',
    features: [
      'POST /api/projects — create projects programmatically',
      'GET /api/projects — list all org projects',
      'API key authentication (X-API-Key header)',
      'Full JSON request/response format',
      'In-app documentation with example payloads',
    ],
  },
  {
    icon: Database,
    title: 'CRM & ERP Sync',
    status: 'coming',
    desc: 'Two-way sync with popular CRM and ERP platforms. Opportunities created in your CRM automatically appear in Procuvex, and bid outcomes sync back.',
    features: [
      'Salesforce, HubSpot (planned)',
      'Bi-directional opportunity sync',
      'Custom field mapping',
      'Automated stage updates',
    ],
  },
  {
    icon: Search,
    title: 'GovWin / Deltek Integration',
    status: 'coming',
    desc: 'Import opportunities from GovWin and Deltek intelligence platforms. Enrich projects with market research data and competitor intelligence.',
    features: [
      'Opportunity import from GovWin',
      'Market research enrichment',
      'Competitor data overlay',
      'Pipeline intelligence sync',
    ],
  },
]

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-3">Integrations</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Connect Your <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Procurement Stack</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Pull opportunities from SAM.gov, import from spreadsheets, or connect via API. Your data flows in — Procuvex handles the rest.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="space-y-8">
            {integrations.map((integ, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <integ.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{integ.title}</h3>
                      {integ.status === 'live' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          <Zap className="h-3 w-3" /> Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                          <Clock className="h-3 w-3" /> Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 leading-relaxed mb-4">{integ.desc}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {integ.features.map((f, j) => (
                        <div key={j} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Need a Custom Integration?</h2>
          <p className="text-lg text-blue-100 mb-8">Our REST API supports any system that can make HTTP requests. Contact us for enterprise integration support.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all">
              Start Free Trial <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center px-8 py-3.5 font-semibold border-2 border-white/30 hover:border-white/60 rounded-xl transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
