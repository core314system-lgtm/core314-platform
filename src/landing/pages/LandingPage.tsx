import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ChevronDown, Shield, Lock, Server, Eye,
  FileText, Brain, Target, BarChart3, Users, Kanban,
  DollarSign, ClipboardCheck, Zap, CheckCircle, Building2,
  HardHat, Monitor, ShoppingCart, AlertTriangle, Clock, TrendingUp,
  Award, Globe, Star, Quote,
} from 'lucide-react'
import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const proofMetrics = [
  { value: '11+', label: 'AI Modules' },
  { value: '5', label: 'Industries' },
  { value: 'Seconds', label: 'To Analyze Documents' },
  { value: '100%', label: 'Your Data, Your Control' },
]

const painPoints = [
  {
    icon: AlertTriangle,
    title: 'Scattered Documents Sink Bids',
    desc: 'SOWs, pricing sheets, and amendments scattered across email, shared drives, and desktops. By the time you assemble everything, deadlines are already closing in.',
  },
  {
    icon: Clock,
    title: 'Manual Compliance Is a Liability',
    desc: 'Manually cross-referencing requirements against your proposal takes days. Miss one clause and your bid is non-responsive. The stakes are too high for spreadsheets.',
  },
  {
    icon: TrendingUp,
    title: 'You Bid Blind Without Intelligence',
    desc: 'No visibility into which bids are on track, which are at risk, or what you learned from past wins and losses. Every bid starts from zero.',
  },
]

const benefits = [
  {
    icon: Brain,
    title: 'AI Extracts Requirements in Seconds',
    desc: 'Upload your SOW and Procuvex identifies every requirement, service category, unclear item, and pricing risk automatically.',
  },
  {
    icon: Shield,
    title: 'Compliance Matrices Generated Automatically',
    desc: 'One click generates a full compliance matrix mapping each requirement to your response status. No more manual cross-referencing.',
  },
  {
    icon: Kanban,
    title: 'Pipeline Visibility Across All Bids',
    desc: 'See every project in a kanban board organized by workflow stage. Know exactly where each bid stands at a glance.',
  },
  {
    icon: BarChart3,
    title: 'Cross-Project Intelligence That Learns',
    desc: 'Analytics dashboard tracks win rates, trends, competitor patterns, and upcoming deadlines across your entire portfolio.',
  },
]

const steps = [
  { num: '1', title: 'Create Project & Upload Docs', desc: 'Select your project type, upload SOWs, pricing sheets, and supporting documents. Procuvex organizes everything.' },
  { num: '2', title: 'AI Analyzes & Generates Outputs', desc: 'AI extracts requirements, builds compliance matrices, identifies risks, and generates executive summaries in seconds.' },
  { num: '3', title: 'Collaborate, Track & Win', desc: 'Assign team members, manage subcontractors, track workflow stages, and use intelligence to improve every bid.' },
]

const industries = [
  {
    icon: Building2,
    title: 'Government Contractors',
    desc: 'Task order and RFP management built for FAR/DFARS compliance. SAM.gov integration pulls opportunities directly into your pipeline.',
    features: ['SOW analysis & requirement extraction', 'FAR/DFARS compliance tracking', 'SAM.gov opportunity search & import'],
  },
  {
    icon: HardHat,
    title: 'Construction & Engineering',
    desc: 'Manage bid packages, subcontractor alignment, and pricing across complex construction projects with multiple trade partners.',
    features: ['Subcontractor quote management', 'Multi-trade bid coordination', 'Material & labor risk analysis'],
  },
  {
    icon: Monitor,
    title: 'IT Services & Consulting',
    desc: 'Respond to technical RFPs faster with AI that understands IT requirements, solution design, and staffing compliance.',
    features: ['Technical requirement extraction', 'Solution architecture mapping', 'Labor category compliance'],
  },
  {
    icon: ShoppingCart,
    title: 'Commercial Procurement',
    desc: 'Streamline vendor selection, contract evaluation, and procurement workflows for private sector organizations.',
    features: ['Vendor comparison matrices', 'Contract risk analysis', 'Procurement workflow automation'],
  },
]

const securityFeatures = [
  { icon: Lock, title: 'Row-Level Security', desc: 'Every data query is scoped to your organization. No team can ever see another team\'s data.' },
  { icon: Shield, title: 'Encrypted at Rest & In Transit', desc: 'All data encrypted with AES-256 at rest and TLS 1.3 in transit. Your documents never leave secure infrastructure.' },
  { icon: Server, title: 'Server-Side AI Processing', desc: 'API keys and AI calls happen server-side only. No secrets in your browser. No data exposed to third parties.' },
  { icon: Eye, title: 'You Own Your Data', desc: 'Your documents and analysis results belong to you. We never train AI models on your data or share it with anyone.' },
]

const trustBadges = [
  { icon: Shield, title: 'SOC 2 Type II Architecture', desc: 'Built on Supabase enterprise infrastructure with SOC 2 compliance' },
  { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit with TLS 1.3' },
  { icon: Globe, title: 'ITAR / CUI Capable', desc: 'Architecture supports controlled unclassified information workflows' },
  { icon: Award, title: 'FedRAMP-Ready Infrastructure', desc: 'Hosted on cloud infrastructure with FedRAMP authorization path' },
]

const testimonials = [
  {
    quote: 'We used to spend 3 days building a compliance matrix for every RFP. Procuvex does it in minutes. Our win rate has already improved because we can focus on strategy instead of paperwork.',
    name: 'Director of Business Development',
    company: 'Mid-Size Government Contractor',
    industry: '$15M Annual Revenue',
    metric: '70% faster proposal prep',
  },
  {
    quote: 'The SAM.gov opportunity feed changed everything. We went from manually searching SAM.gov every morning to having matched opportunities in our pipeline automatically. We\'re bidding on 3x more contracts.',
    name: 'Capture Manager',
    company: 'IT Services Firm',
    industry: '$8M Annual Revenue',
    metric: '3x more bids submitted',
  },
  {
    quote: 'Managing subcontractor quotes used to be a nightmare of spreadsheets and emails. Now our subs submit quotes through the portal and we compare them side by side. Game changer for construction bids.',
    name: 'Estimating Lead',
    company: 'Construction & Engineering Firm',
    industry: '$25M Annual Revenue',
    metric: '50% less coordination time',
  },
]

const faqs = [
  { q: 'What is Procuvex?', a: 'Procuvex is an AI-powered procurement operating system. It helps organizations manage bids, analyze documents, track compliance, coordinate subcontractors, and gain intelligence across all their projects — whether government, construction, IT, or commercial.' },
  { q: 'How does the AI document analysis work?', a: 'Upload your SOW, RFP, or bid documents. Procuvex uses AI to extract every requirement, identify service categories, flag unclear items, highlight pricing risks, and generate a structured analysis — typically in under 30 seconds.' },
  { q: 'Is my data secure?', a: 'Absolutely. All data is encrypted at rest and in transit. AI processing happens server-side only — no API keys or document content ever reaches the browser. Row-level security ensures your organization\'s data is completely isolated.' },
  { q: 'What industries does Procuvex support?', a: 'Procuvex supports five project types out of the box: Government Task Orders, Government RFPs, Construction Bids, IT Services, and Commercial Procurement. Each type has tailored workflow stages, labels, and analytics.' },
  { q: 'Does Procuvex integrate with SAM.gov?', a: 'Yes. The dedicated Opportunity Feed pulls federal contract opportunities from SAM.gov and uses AI to score each one (0–100%) based on your NAICS codes, set-aside preferences, and capabilities. Urgency badges flag approaching deadlines, and one-click import creates a project with all details pre-populated — solicitation number, agency, deadline, NAICS code, and more.' },
  { q: 'Can I import existing projects?', a: 'Yes. Procuvex supports CSV/Excel bulk import and a REST API. You can import projects from spreadsheets or connect from your CRM, ERP, or custom tools.' },
  { q: 'What does the AI Disclaimer mean?', a: 'All AI-generated outputs (analysis, compliance matrices, recommendations) are advisory tools to support your decision-making. They are not a substitute for professional legal, financial, or procurement advice. You remain responsible for all bid decisions.' },
  { q: 'How much does Procuvex cost?', a: 'Procuvex offers two tiers: Growth at $2,500/month (for teams with $5M-50M pipeline) and Enterprise at $5,000/month (for teams with $50M-500M+ pipeline). Both include a 7-day free trial. Annual billing saves 20%. Visit our Pricing page for full details.' },
  { q: 'What is the uptime guarantee?', a: 'Procuvex guarantees 99.9% uptime backed by our published SLA. All services include automated health monitoring, retry logic with circuit breakers, and self-healing infrastructure. View real-time system status at any time on our Status page.' },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pb-5 pr-8">
          <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* HERO */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              AI-Powered Procurement for Every Industry
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Win More Bids.{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Waste Less Time.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-4"
            >
              Procuvex analyzes your bid documents, generates compliance matrices, tracks your pipeline,
              and gives you intelligence across every project — so your team spends time winning, not searching.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-base text-slate-500 mb-8"
            >
              Government. Construction. IT. Commercial. One platform for all procurement.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mb-4"
            >
              <Link
                to="/pricing"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
              >
                See How It Works
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="text-sm text-slate-400"
            >
              7-day free trial &middot; Set up in minutes &middot; Cancel anytime
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="mt-14 max-w-3xl mx-auto"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4">
              {proofMetrics.map(m => (
                <div key={m.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{m.value}</div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="py-20 lg:py-28 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="text-amber-400 text-sm font-bold uppercase tracking-wider mb-3">The Cost of Manual Procurement</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Every Missed Requirement Costs You the Bid
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Most teams don&apos;t lose bids because of price. They lose because of preventable errors: missed clauses, late submissions, and scattered information.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {painPoints.map((p, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5">
                  <p.icon className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">{p.title}</h3>
                <p className="text-slate-300 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SUBCONTRACTOR NETWORK — THE DIFFERENTIATOR */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }} />
          {/* Network grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="landing-grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#landing-grid)" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-blue-200 mb-6">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" /></span>
              Our #1 Competitive Advantage
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              The Verified Subcontractor Network
            </h2>
            <p className="text-lg text-blue-200 max-w-3xl mx-auto leading-relaxed">
              No other platform connects prime contractors with a verified database of 18,000+ subcontractors. This is the feature that changes how government teams are built.
            </p>
          </motion.div>

          {/* Animated Stats */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto my-12">
            {[
              { value: '18,000+', label: 'Subcontractors' },
              { value: '200+', label: 'Trade Categories' },
              { value: '50', label: 'States Covered' },
              { value: 'Real-Time', label: 'Auto-Matching' },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="text-center">
                <div className="text-3xl md:text-4xl font-extrabold text-white">{stat.value}</div>
                <div className="text-sm text-blue-300 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Two-sided value prop */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mt-14">
            <motion.div variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-blue-300" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Prime Contractors</h3>
              <ul className="space-y-3">
                {['Search verified subs by trade, location & certification', 'AI auto-matches subs to your RFQ requirements', 'One-click RFQ distribution to qualified subs', 'Build winning teams in minutes, not weeks'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-blue-100 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/pricing" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-white text-blue-900 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                <HardHat className="h-6 w-6 text-green-300" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Subcontractors</h3>
              <ul className="space-y-3">
                {['Get discovered by primes actively looking to team', 'Verified badge builds trust and credibility', 'Auto-matched to relevant RFQ opportunities', 'Certification expiration alerts keep you compliant'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-blue-100 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/for-subcontractors" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-600 transition-colors">
                Check Your Listing <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Animated Workflow */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.6, delay: 0.3 }} className="mt-16 max-w-5xl mx-auto">
            <h3 className="text-center text-xl font-bold mb-8 text-blue-200">How Auto-Matching Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              {[
                { step: '1', label: 'Prime posts RFQ', icon: '📋' },
                { step: '→', label: '', icon: '' },
                { step: '2', label: 'AI matches subs', icon: '🤖' },
                { step: '→', label: '', icon: '' },
                { step: '3', label: 'Team assembled', icon: '🤝' },
              ].map((s, i) => (
                s.icon ? (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.15 }}
                    className="text-center bg-white/5 border border-white/10 rounded-xl p-4"
                  >
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <div className="text-sm font-medium text-white">{s.label}</div>
                  </motion.div>
                ) : (
                  <div key={i} className="hidden md:flex items-center justify-center">
                    <ArrowRight className="h-6 w-6 text-blue-400 animate-pulse" />
                  </div>
                )
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* COMPETITIVE ADVANTAGE */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="text-blue-600 text-sm font-bold uppercase tracking-wider mb-3">Why We Win</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              What No Other Platform Offers
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Competitors help you manage bids. Only Procuvex helps you build winning teams.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="max-w-4xl mx-auto overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-4 font-bold text-slate-900">Feature</th>
                  <th className="text-center px-6 py-4 font-bold text-blue-600">Procuvex</th>
                  <th className="text-center px-6 py-4 font-bold text-slate-500">Competitors</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Verified Subcontractor Database', us: true, them: false },
                  { feature: 'AI Auto-Matching (Primes ↔ Subs)', us: true, them: false },
                  { feature: 'Two-Sided Network (Primes + Subs)', us: true, them: false },
                  { feature: 'Sub Verification & Badges', us: true, them: false },
                  { feature: 'AI Document Analysis', us: true, them: true },
                  { feature: 'Compliance Tracking', us: true, them: true },
                  { feature: 'Pipeline Management', us: true, them: true },
                  { feature: 'Certification Expiration Alerts', us: true, them: false },
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-6 py-3 text-slate-800 font-medium">{row.feature}</td>
                    <td className="text-center px-6 py-3">
                      <CheckCircle className="h-5 w-5 text-green-500 inline" />
                    </td>
                    <td className="text-center px-6 py-3">
                      {row.them ? (
                        <CheckCircle className="h-5 w-5 text-slate-300 inline" />
                      ) : (
                        <span className="text-red-400 font-bold text-lg">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          <div className="mt-10 text-center">
            <Link to="/for-subcontractors" className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all">
              Explore the Network <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="text-blue-600 text-sm font-bold uppercase tracking-wider mb-3">How Procuvex Helps</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              From Document Upload to Bid Submission
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Procuvex handles the heavy lifting so your team can focus on strategy, not paperwork.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                  <b.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{b.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 lg:py-28 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="text-blue-600 text-sm font-bold uppercase tracking-wider mb-3">Simple & Powerful</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              How It Works
            </h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((s, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-600/25">
                  <span className="text-2xl font-extrabold text-white">{s.num}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-12 text-center">
            <Link to="/how-it-works" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors">
              See the full walkthrough <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="text-blue-600 text-sm font-bold uppercase tracking-wider mb-3">Multi-Industry</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Built for How Your Industry Bids
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Each project type has tailored workflow stages, terminology, and analytics.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
            {industries.map((ind, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-slate-50 border border-slate-200 rounded-2xl p-8 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <ind.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{ind.title}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{ind.desc}</p>
                <ul className="space-y-2">
                  {ind.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-10 text-center">
            <Link to="/solutions" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors">
              Explore all solutions <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-slate-50 to-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="text-blue-600 text-sm font-bold uppercase tracking-wider mb-3">Feature Highlights</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Everything You Need to Win
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { icon: FileText, label: 'Document Analysis' },
              { icon: Shield, label: 'Compliance Matrix' },
              { icon: Users, label: 'RFQ Packages' },
              { icon: DollarSign, label: 'Pricing & Risk Analysis' },
              { icon: ClipboardCheck, label: 'Executive Summary' },
              { icon: Target, label: 'SOW Tracking' },
              { icon: Kanban, label: 'Pipeline & Workflow' },
              { icon: Brain, label: 'AI Recommendations' },
              { icon: BarChart3, label: 'Analytics Dashboard' },
              { icon: Users, label: 'Team & Subcontractors' },
              { icon: Zap, label: 'SAM.gov Integration' },
              { icon: Building2, label: 'Intelligence Library' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
              >
                <f.icon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-800">{f.label}</span>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link to="/product" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors">
              See all features <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="py-20 lg:py-28 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="text-blue-400 text-sm font-bold uppercase tracking-wider mb-3">Enterprise-Grade Security</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Your Data. Your Control. Always.
            </h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {securityFeatures.map((s, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <s.icon className="h-8 w-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* TRUST BADGES */}
      <section className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-10">
            <p className="text-blue-600 text-sm font-bold uppercase tracking-wider mb-3">Trusted & Secure</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Enterprise Security, Small Business Simplicity
            </h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {trustBadges.map((badge, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center hover:shadow-sm transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                  <badge.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{badge.title}</h3>
                <p className="text-xs text-slate-500">{badge.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SOCIAL PROOF / TESTIMONIALS */}
      <section className="py-20 lg:py-28 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="text-blue-600 text-sm font-bold uppercase tracking-wider mb-3">Results That Matter</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              What Procurement Teams Are Saying
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From compliance automation to opportunity discovery, teams are transforming how they bid.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
                <Quote className="h-8 w-8 text-blue-200 mb-4" />
                <p className="text-sm text-slate-700 leading-relaxed flex-1 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.company}</p>
                      <p className="text-xs text-slate-400">{t.industry}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-0.5 justify-end mb-1">
                        {[...Array(5)].map((_, j) => <Star key={j} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                        {t.metric}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PRICING CTA - links to pricing page */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }}>
            <p className="text-blue-600 text-sm font-bold uppercase tracking-wider mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Plans That Scale With Your Pipeline
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              Two tiers designed for procurement teams winning $10M–$1B+ contracts. Start with a 7-day free trial.
            </p>
            <Link
              to="/pricing"
              className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200"
            >
              View Pricing Plans
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-28 bg-slate-50 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Frequently Asked Questions
            </h2>
          </motion.div>
          <div className="divide-y divide-slate-200">
            {faqs.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Ready to Win More Bids?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            Join procurement teams who use Procuvex to analyze documents faster, track compliance automatically, and make smarter bid decisions.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              to="/pricing"
              className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white border-2 border-white/30 hover:border-white/60 rounded-xl transition-colors"
            >
              Contact Sales
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
