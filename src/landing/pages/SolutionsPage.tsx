import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Building2, HardHat, Monitor, ShoppingCart,
  CheckCircle, Users, Briefcase, Shield, BarChart3,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const industries = [
  {
    id: 'government',
    icon: Building2,
    title: 'Government Contractors',
    subtitle: 'Task orders, RFPs, and federal procurement',
    desc: 'Built for the complexity of government contracting. Procuvex understands FAR/DFARS, NAICS codes, set-aside requirements, and the unique workflow of federal procurement.',
    features: [
      'AI extracts FAR/DFARS compliance requirements from SOWs',
      'SAM.gov integration pulls active opportunities into your pipeline',
      'Compliance matrix maps every clause to your response',
      'AI maps SOW line items to 45-trade taxonomy and matches subs by radius',
      'RFQ Composer with merge fields, live preview, and branded templates',
      'Workflow stages: New/Intake, Evaluating, Bid Review, Submitted, Awarded, Not Awarded',
    ],
    color: 'blue',
  },
  {
    id: 'construction',
    icon: HardHat,
    title: 'Construction & Engineering Firms',
    subtitle: 'Bid packages, subcontractor coordination, and estimating',
    desc: 'Manage complex multi-trade bids where subcontractor alignment, material pricing, and compliance intersect. Procuvex keeps everything in one place.',
    features: [
      'Track multiple subcontractor quotes per service category',
      'Find subs within 10–200 miles of the job site with radius-based matching',
      'Compose branded RFQs with merge fields and send to matched subs',
      'AI Quote Compliance Engine analyzes every quote against your SOW',
      'Pricing Decision Matrix ranks subs by best value with weighted scoring',
      'Real-time pipeline visibility across all active bids',
    ],
    color: 'amber',
  },
  {
    id: 'it-services',
    icon: Monitor,
    title: 'IT Services & Consulting',
    subtitle: 'Technical proposals and staffing compliance',
    desc: 'Respond to technical RFPs with AI that understands solution requirements, staffing plans, and technology stack compliance.',
    features: [
      'Technical requirement extraction from complex RFPs',
      'AI SOW-to-trade mapping finds qualified subs automatically',
      'Labor category and certification compliance tracking',
      'Combinable Local/Regional/National search scopes for sub matching',
      'Team assignment with role-based access',
      'Executive summary generation for internal review boards',
    ],
    color: 'purple',
  },
  {
    id: 'commercial',
    icon: ShoppingCart,
    title: 'Commercial Procurement',
    subtitle: 'Vendor management and contract evaluation',
    desc: 'Streamline vendor selection, contract evaluation, and procurement workflows for private sector organizations of any size.',
    features: [
      'Vendor comparison matrices across multiple criteria',
      'Contract risk analysis highlights unfavorable terms',
      'Procurement workflow from intake through contracting',
      'Workflow stages: Intake, Evaluation, Approval, Contracted, Complete, Cancelled',
      'CSV/Excel import from existing procurement systems',
      'REST API for integration with ERP and financial systems',
    ],
    color: 'green',
  },
]

const roles = [
  {
    icon: Briefcase,
    title: 'BD & Capture Managers',
    desc: 'Pipeline visibility across all opportunities. Know which bids are on track, which need attention, and where your team should focus next.',
    benefits: ['Pipeline kanban board', 'Bid readiness checklist', 'Win/loss analytics'],
  },
  {
    icon: Shield,
    title: 'Proposal Managers',
    desc: 'AI-generated compliance matrices, requirement tracking, and document analysis eliminate days of manual work on every proposal.',
    benefits: ['Automated compliance matrix', 'Requirement extraction', 'Executive summary generation'],
  },
  {
    icon: Users,
    title: 'Subcontractor Coordinators',
    desc: 'Manage your subcontractor database, match capabilities to requirements, send RFQs, and track quotes — all from one platform.',
    benefits: ['AI-powered sub matching', 'RFQ email integration', 'Quote comparison tools'],
  },
  {
    icon: BarChart3,
    title: 'Executives & Leadership',
    desc: 'Cross-project analytics and intelligence library provide the strategic view: win rates, competitor patterns, and organizational trends.',
    benefits: ['Analytics dashboard', 'Intelligence library', 'Competitor landscape'],
  },
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  amber: 'bg-amber-100 text-amber-600',
  purple: 'bg-purple-100 text-purple-600',
  green: 'bg-green-100 text-green-600',
}

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-3">Solutions</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              One Platform. <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Every Industry.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Procuvex adapts to your industry with tailored workflows, terminology, and analytics. Select your sector to see how it fits.
            </motion.p>
          </div>
        </div>
      </section>

      {/* By Industry */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-10 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>By Industry</h2>

          <div className="space-y-10">
            {industries.map((ind, i) => (
              <motion.div
                key={i}
                id={ind.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="bg-white border border-slate-200 rounded-2xl p-8 lg:p-10 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[ind.color]}`}>
                    <ind.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{ind.title}</h3>
                    <p className="text-sm text-slate-500">{ind.subtitle}</p>
                  </div>
                </div>
                <p className="text-slate-600 leading-relaxed mb-6">{ind.desc}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ind.features.map((f, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* By Role */}
      <section className="py-16 lg:py-24 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-10 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>By Role</h2>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((role, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                  <role.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{role.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{role.desc}</p>
                <ul className="space-y-2">
                  {role.benefits.map((b, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Industry Glossary */}
      <section className="py-16 lg:py-20 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>Industry Terms Glossary</h2>
          <p className="text-sm text-slate-500 text-center mb-8">New to government contracting? Here are the key terms you'll see throughout Procuvex.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { term: 'FAR', def: 'Federal Acquisition Regulation — the rules governing how the federal government buys goods and services.' },
              { term: 'DFARS', def: 'Defense Federal Acquisition Regulation Supplement — additional rules for Department of Defense contracts.' },
              { term: 'SOW', def: 'Statement of Work — describes the tasks, deliverables, and timeline required under a contract.' },
              { term: 'NAICS', def: 'North American Industry Classification System — a 6-digit code classifying businesses by industry.' },
              { term: 'RFP', def: 'Request for Proposal — a solicitation asking vendors to submit a formal proposal.' },
              { term: 'RFQ', def: 'Request for Quote — a solicitation asking vendors to submit pricing for specific goods or services.' },
              { term: 'SAM.gov', def: 'System for Award Management — the federal database for contractor registration and opportunity posting.' },
              { term: 'CUI', def: 'Controlled Unclassified Information — sensitive but unclassified government data requiring safeguarding.' },
              { term: 'FedRAMP', def: 'Federal Risk and Authorization Management Program — standardized security assessment for cloud products.' },
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="font-semibold text-blue-600 text-sm mb-1">{item.term}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{item.def}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Find Your Fit</h2>
          <p className="text-lg text-blue-100 mb-8">Start a free trial and configure Procuvex for your industry and team.</p>
          <Link to="/login" className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all">
            Start Free Trial <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
