import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  FileText, Brain, Shield, Users, DollarSign, ClipboardCheck,
  Target, Kanban, BarChart3, Zap, Building2, ArrowRight,
  Upload, CheckCircle, MessageSquare,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.06 } } }

const modules = [
  {
    icon: Upload,
    title: 'Document Upload & Organization',
    desc: 'Upload SOWs, pricing sheets, amendments, exhibits, and supporting documents. Procuvex organizes them by category with drag-and-drop support.',
    features: ['10 document categories', 'PDF, DOCX, XLSX support', 'Bulk upload', 'Automatic category detection'],
  },
  {
    icon: Brain,
    title: 'AI Document Analysis',
    desc: 'AI reads your entire document set and extracts every requirement, service category, unclear item, pricing risk, and key metadata in seconds.',
    features: ['Requirement extraction', 'Service category identification', 'Unclear item flagging', 'Pricing alignment analysis', 'Period of performance detection'],
  },
  {
    icon: Shield,
    title: 'Compliance Matrix',
    desc: 'Automatically generates a compliance matrix mapping each requirement to your response status: compliant, partially compliant, or non-compliant.',
    features: ['Auto-generated from analysis', 'Exportable to Excel/PDF', 'Editable response status', 'Evidence linking'],
  },
  {
    icon: FileText,
    title: 'RFQ Package Generator',
    desc: 'Creates ready-to-send Request for Quote packages for each service category, pre-populated with scope details and subcontractor requirements.',
    features: ['Per-category packages', 'Email integration', 'Quote tracking', 'Response management'],
  },
  {
    icon: DollarSign,
    title: 'Pricing & Risk Analysis',
    desc: 'AI identifies pricing risks, labor category concerns, material cost variables, and areas where your proposal might be under- or over-estimated.',
    features: ['Risk severity ratings', 'Mitigation recommendations', 'Cost driver identification', 'Market rate comparisons'],
  },
  {
    icon: ClipboardCheck,
    title: 'Executive Summary',
    desc: 'Generates a polished executive summary of the opportunity suitable for internal review, go/no-go decisions, and management briefings.',
    features: ['One-click generation', 'Customizable format', 'Key metrics highlighted', 'Export to Word/PDF'],
  },
  {
    icon: Target,
    title: 'SOW Bid Management',
    desc: 'Track each SOW line item, assign subcontractors, manage quotes, and monitor pricing across the entire bid package.',
    features: ['Line item tracking', 'Subcontractor assignment', 'Quote comparison', 'Custom form builder'],
  },
  {
    icon: Kanban,
    title: 'Pipeline & Workflow Engine',
    desc: 'Customizable workflow stages per project type. Kanban board view shows every bid in your pipeline at a glance.',
    features: ['Industry-specific stages', 'Drag-and-drop pipeline', 'Stage change audit trail', 'Team assignments per stage'],
  },
  {
    icon: Users,
    title: 'Subcontractor Management',
    desc: 'Maintain a database of subcontractors with capabilities, certifications, past performance, and automated matching to project requirements.',
    features: ['Capability profiles', 'AI-powered matching', 'RFQ email integration', 'Performance tracking'],
  },
  {
    icon: BarChart3,
    title: 'Analytics & Intelligence',
    desc: 'Cross-project metrics dashboard showing win rates, project distribution, monthly trends, upcoming deadlines, and competitor landscape.',
    features: ['Win/loss analysis', 'Pipeline value tracking', 'Competitor profiles', 'Bid readiness scoring'],
  },
  {
    icon: Zap,
    title: 'Integrations',
    desc: 'Search SAM.gov for federal opportunities, import projects from CSV/Excel, or connect via REST API from your CRM, ERP, or custom tools.',
    features: ['SAM.gov search & import', 'CSV/Excel bulk import', 'REST API (create/list)', 'API key authentication'],
  },
  {
    icon: MessageSquare,
    title: 'AI Q&A Management',
    desc: 'Subcontractors submit questions through the RFQ portal. AI instantly searches all bid documents and answers questions it can verify — with exact source citations. Unanswerable questions are queued for the formal Q&A submission deadline.',
    features: ['AI-powered document search', 'Source citations (doc, section, page)', 'Auto-answer vs. pending routing', 'Question deadline tracking'],
  },
  {
    icon: Building2,
    title: 'Intelligence Library',
    desc: 'Capture win/loss debriefs after every bid. Over time, build an organizational knowledge base of lessons learned, pricing insights, and competitor intelligence.',
    features: ['Structured debriefs', 'Competitor tracking', 'Pricing benchmarks', 'Lessons learned repository'],
  },
]

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-3">Product</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Every Tool Your <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Bid Team</span> Needs
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              12 integrated modules that take you from document upload to bid submission — with AI doing the heavy lifting.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="space-y-8">
            {modules.map((mod, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className={`flex flex-col md:flex-row gap-8 items-start p-8 rounded-2xl border border-slate-200 hover:shadow-md transition-shadow ${
                  i % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <mod.icon className="h-7 w-7 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>{mod.title}</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">{mod.desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mod.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>See It in Action</h2>
          <p className="text-lg text-blue-100 mb-8">Start your free trial and explore every module with your own documents.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all">
              Start Free Trial <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center px-8 py-3.5 font-semibold border-2 border-white/30 hover:border-white/60 rounded-xl transition-colors">
              Request a Demo
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
