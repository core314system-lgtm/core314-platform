import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { SIGNUP_ENABLED, PRICING_VISIBLE } from '../../config/signupConfig'
import {
  ArrowRight, ChevronDown, Shield, Lock, Server, Eye,
  FileText, Brain, Target, BarChart3, Users, Kanban,
  DollarSign, ClipboardCheck, Zap, CheckCircle, Building2,
  HardHat, Monitor, ShoppingCart, AlertTriangle, Clock, TrendingUp,
  Award, Globe, Star, Quote, Mail, Crosshair, ShieldCheck,
  Palette, UserCheck, Scale, Search, Briefcase, ListChecks, KeyRound,
  Contact2, CheckSquare, MessageSquare, Wand2, Bell,
} from 'lucide-react'
import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useNetworkStats } from '../hooks/useNetworkStats'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const proofMetrics = [
  { value: '30+', label: 'AI Modules' },
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
    features: ['SOW analysis & requirement extraction', 'FAR/DFARS compliance tracking', 'SAM.gov opportunity search & import', 'Shipley capture gate reviews', 'AI past performance matching', 'Section L/M evaluation criteria analysis'],
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
  { icon: KeyRound, title: 'MFA & SSO', desc: 'Multi-factor authentication (TOTP) for all accounts. SAML SSO for enterprise customers. Enforce org-wide security policies.' },
]

const trustBadges = [
  { icon: Shield, title: 'SOC 2 Type II Architecture', desc: 'Built on Supabase enterprise infrastructure with SOC 2 compliance' },
  { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit with TLS 1.3' },
  { icon: Globe, title: 'ITAR / CUI', desc: 'Not currently pursued — architecture designed to support CUI workflows upon enterprise customer requirement' },
  { icon: Award, title: 'FedRAMP Authorization', desc: 'Not currently pursued — platform can support future FedRAMP-authorized deployment if customer demand requires it' },
  { icon: KeyRound, title: 'MFA & SAML SSO', desc: 'TOTP multi-factor authentication and SAML single sign-on for enterprise security' },
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
  {
    quote: 'The Capture Gate Reviews and AI past performance matching changed our BD process. We used to scramble to find relevant citations two days before the proposal was due. Now AI recommends the best matches instantly, and gate reviews keep every deal on track.',
    name: 'VP of Capture Management',
    company: 'Defense & Aerospace Contractor',
    industry: '$50M Annual Revenue',
    metric: '40% fewer no-bid surprises',
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
  { q: 'What is the Past Performance Library?', a: 'The Past Performance Library is an org-wide repository of all your past performance citations. Upload CPARS reports, SF-330s, or proposal past performance volumes — AI extracts contract details, CPARS ratings, narratives, and key personnel automatically. When working on a new project, AI searches your library and recommends the most relevant citations based on NAICS codes, agency, scope, dollar value, and recency.' },
  { q: 'Does Procuvex support Shipley gate reviews?', a: 'Yes. Procuvex includes a full Shipley-aligned capture gate review process — Gate 0 (Qualification) through Gate 4 (Submit). Each gate includes a customizable checklist, scheduled/completed dates, and GO/NO-GO/CONDITIONAL GO decisions with rationale. You can customize the gate structure at both the organization level (Settings → Gate Templates) and per-project.' },
  { q: 'Can Procuvex analyze Section L & M?', a: 'Yes. Upload RFP Section L & M documents and AI extracts evaluation criteria, scoring methodology, proposal structure requirements, and page limits. This helps your team align the proposal to exactly what evaluators are looking for.' },
  { q: 'Does Procuvex generate Small Business Subcontracting Plans?', a: 'Yes. The SB Subcontracting Plan module generates FAR 52.219-9 compliant plans with pre-populated federal default goals (SB 23%, SDB 5%, WOSB 5%, HUBZone 3%, SDVOSB 3%). Dollar goals auto-calculate from your total subcontracting value. Add planned subcontractors and generate the plan narrative.' },
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
  const stats = useNetworkStats()
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
              Trusted by Government Contractors & Construction Teams
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Win More Government Contracts.{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                In Less Time.
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
                to={PRICING_VISIBLE ? '/pricing' : '/demo'}
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200"
              >
                {SIGNUP_ENABLED ? 'Start Free Trial' : 'Request a Demo'}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/demo"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl transition-colors"
              >
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Watch Full Demo
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
              No other platform connects prime contractors with a verified database of this size. AI-powered matching by trade, radius, and compliance — this is the feature that changes how government teams are built.
            </p>
          </motion.div>

          {/* Animated Stats */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto my-12">
            {[
              { value: stats.loading ? '...' : `${Math.floor(stats.total / 1000)}K+`, label: 'Subcontractors' },
              { value: '45+', label: 'Trade Categories' },
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
                {['Search subs by trade, radius (10–200 mi), or region', 'AI maps your SOW line items to qualified subs', 'Compose & preview branded RFQs before sending', 'Combine Local + Regional + National search scopes'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-blue-100 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to={PRICING_VISIBLE ? '/pricing' : '/demo'} className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-white text-blue-900 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors">
                {SIGNUP_ENABLED ? 'Start Free Trial' : 'Request a Demo'} <ArrowRight className="h-4 w-4" />
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
                  { feature: 'AI Quote Compliance Analysis', us: true, them: false },
                  { feature: 'Pricing Decision Matrix with Best Value Scoring', us: true, them: false },
                  { feature: 'Certification Expiration Alerts', us: true, them: false },
                  { feature: 'AI Past Performance Extraction & Matching', us: true, them: false },
                  { feature: 'Customizable Shipley Capture Gate Reviews', us: true, them: false },
                  { feature: 'AI Section L/M Evaluation Analysis', us: true, them: false },
                  { feature: 'Price-to-Win Competitive Pricing', us: true, them: false },
                  { feature: 'FPDS Competitive Intelligence', us: true, them: false },
                  { feature: 'SB Subcontracting Plan Generator (FAR 52.219-9)', us: true, them: false },
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

      {/* AI QUOTE COMPLIANCE ENGINE */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-900 text-white relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-purple-200 mb-6">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" /></span>
              AI-Powered Quality Assurance
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              AI Quote Compliance Engine
            </h2>
            <p className="text-lg text-purple-200 max-w-3xl mx-auto leading-relaxed">
              Every subcontractor quote is automatically analyzed against your Statement of Work. Gaps are identified instantly. Subcontractors are notified automatically. No manual reviews needed.
            </p>
          </motion.div>

          {/* Animated Flow */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ duration: 0.6, delay: 0.2 }} className="mt-14 max-w-5xl mx-auto">
            <h3 className="text-center text-xl font-bold mb-8 text-purple-200">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              {[
                { step: '1', label: 'Sub submits quote', icon: '📝', desc: 'Via portal' },
                { step: '→', label: '', icon: '', desc: '' },
                { step: '2', label: 'AI scans vs SOW', icon: '🤖', desc: 'Every requirement' },
                { step: '→', label: '', icon: '', desc: '' },
                { step: '3', label: 'Gaps identified', icon: '🎯', desc: 'Score + details' },
              ].map((s, i) => (
                s.icon ? (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.15 }}
                    className="text-center bg-white/5 border border-white/10 rounded-xl p-5"
                  >
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <div className="text-sm font-semibold text-white">{s.label}</div>
                    <div className="text-xs text-purple-300 mt-1">{s.desc}</div>
                  </motion.div>
                ) : (
                  <div key={i} className="hidden md:flex items-center justify-center">
                    <ArrowRight className="h-6 w-6 text-purple-400 animate-pulse" />
                  </div>
                )
              ))}
            </div>

            {/* Second row of flow */}
            <div className="flex justify-center my-4">
              <ArrowRight className="h-6 w-6 text-purple-400 animate-pulse rotate-90" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center max-w-3xl mx-auto">
              {[
                { label: 'Sub notified of gaps', icon: '📧', desc: 'Automatic email' },
                { step: '→', label: '', icon: '', desc: '' },
                { label: 'Revised quote submitted', icon: '✅', desc: 'Fully compliant' },
              ].map((s, i) => (
                s.icon ? (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.75 + i * 0.15 }}
                    className="text-center bg-white/5 border border-white/10 rounded-xl p-5"
                  >
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <div className="text-sm font-semibold text-white">{s.label}</div>
                    <div className="text-xs text-purple-300 mt-1">{s.desc}</div>
                  </motion.div>
                ) : (
                  <div key={i} className="hidden md:flex items-center justify-center">
                    <ArrowRight className="h-6 w-6 text-purple-400 animate-pulse" />
                  </div>
                )
              ))}
            </div>
          </motion.div>

          {/* Split benefit cards */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mt-16">
            <motion.div variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-blue-300" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Prime Contractors</h3>
              <ul className="space-y-3">
                {['Know instantly if a sub\'s quote covers every SOW requirement', 'Compliance score (0–100%) for every quote at a glance', 'See exactly which requirements are met, missing, or underpriced', 'Eliminate days of manual compliance review', 'Re-analyze any quote with one click after revisions'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-purple-100 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                <HardHat className="h-6 w-6 text-green-300" />
              </div>
              <h3 className="text-xl font-bold mb-3">For Subcontractors</h3>
              <ul className="space-y-3">
                {['Get specific feedback on exactly what\'s missing from your quote', 'Automated email lists every unaddressed SOW requirement', 'Fix gaps fast — no guessing, no back-and-forth', 'Submit a revised, fully compliant quote through the portal', 'Better quotes mean faster awards and more wins'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-purple-100 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          {/* Value metrics */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-14">
            {[
              { value: 'Seconds', label: 'To Analyze a Quote' },
              { value: '100%', label: 'Requirements Checked' },
              { value: 'Zero', label: 'Manual Reviews' },
              { value: 'Automatic', label: 'Gap Notifications' },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-white">{stat.value}</div>
                <div className="text-sm text-purple-300 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PRICING DECISION MATRIX */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-slate-900 via-blue-950 to-indigo-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div key={i} className="absolute w-2 h-2 rounded-full bg-blue-400/20" style={{ left: `${12 + i * 12}%`, top: `${15 + (i % 3) * 30}%` }} animate={{ y: [0, -20, 0], opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }} />
          ))}
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-300 text-sm font-bold uppercase tracking-wider mb-5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Source Selection Intelligence
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Pricing Decision Matrix
            </h2>
            <p className="text-lg text-blue-200 max-w-3xl mx-auto leading-relaxed">
              Compare every subcontractor quote side by side. AI-powered weighted scoring ranks subs by best value — not just lowest price. Export to Excel for source selection boards.
            </p>
          </motion.div>

          {/* Matrix Visual */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-14">
            {/* Left: Matrix mockup */}
            <motion.div variants={fadeUp} className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs text-blue-300 ml-2">Pricing Decision Matrix — Side-by-Side Comparison</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-2 px-2 text-blue-300 font-semibold">SOW Line Item</th>
                      <th className="text-center py-2 px-2 text-blue-300 font-semibold">Sub A</th>
                      <th className="text-center py-2 px-2 text-blue-300 font-semibold">Sub B</th>
                      <th className="text-center py-2 px-2 text-blue-300 font-semibold">Sub C</th>
                      <th className="text-center py-2 px-2 text-gray-400 font-semibold">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'HVAC Maintenance', a: '$142,000', b: '$158,000', c: '$135,000', avg: '$145,000', low: 2 },
                      { name: 'Fire Protection', a: '$89,000', b: '$94,500', c: '$91,200', avg: '$91,567', low: 0 },
                      { name: 'Janitorial Services', a: '$67,500', b: '$61,000', c: '$72,400', avg: '$66,967', low: 1 },
                      { name: 'Electrical Systems', a: '$112,000', b: '$108,500', c: '$119,800', avg: '$113,433', low: 1 },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-white/10">
                        <td className="py-2 px-2 text-white font-medium">{row.name}</td>
                        <td className={`py-2 px-2 text-center ${row.low === 0 ? 'text-green-400 font-bold' : 'text-white'}`}>{row.a}</td>
                        <td className={`py-2 px-2 text-center ${row.low === 1 ? 'text-green-400 font-bold' : 'text-white'}`}>{row.b}</td>
                        <td className={`py-2 px-2 text-center ${row.low === 2 ? 'text-green-400 font-bold' : 'text-white'}`}>{row.c}</td>
                        <td className="py-2 px-2 text-center text-gray-400">{row.avg}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-blue-400/50 font-bold">
                      <td className="py-2 px-2 text-blue-300">TOTAL</td>
                      <td className="py-2 px-2 text-center text-white">$410,500</td>
                      <td className="py-2 px-2 text-center text-green-400">$422,000</td>
                      <td className="py-2 px-2 text-center text-white">$418,400</td>
                      <td className="py-2 px-2 text-center text-gray-400">$416,967</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Right: Weighted Scoring */}
            <motion.div variants={fadeUp} className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <h4 className="text-sm font-bold text-blue-300 mb-4">Weighted Best Value Scoring</h4>
              {[
                { name: 'Sub B — Apex Mechanical', score: 87, rank: 1, price: 85, compliance: 92, perf: 88, cert: 75 },
                { name: 'Sub C — ProServ FM', score: 79, rank: 2, price: 78, compliance: 85, perf: 70, cert: 100 },
                { name: 'Sub A — First Coast', score: 74, rank: 3, price: 92, compliance: 68, perf: 65, cert: 50 },
              ].map((sub) => (
                <div key={sub.rank} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${sub.rank === 1 ? 'bg-yellow-400 text-yellow-900' : sub.rank === 2 ? 'bg-gray-300 text-gray-700' : 'bg-amber-600 text-white'}`}>{sub.rank}</span>
                      <span className="text-sm text-white font-medium">{sub.name}</span>
                    </div>
                    <span className={`text-lg font-bold ${sub.score >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>{sub.score}/100</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full ${sub.score >= 80 ? 'bg-gradient-to-r from-green-400 to-emerald-400' : 'bg-gradient-to-r from-yellow-400 to-amber-400'}`} style={{ width: `${sub.score}%` }} />
                  </div>
                  <div className="flex gap-3 text-xs text-blue-300/70">
                    <span>Price: {sub.price}</span>
                    <span>Compliance: {sub.compliance}</span>
                    <span>Perf: {sub.perf}</span>
                    <span>Certs: {sub.cert}</span>
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-3 border-t border-white/20 text-xs text-blue-300/80">
                Weights: Price 40% | Compliance 30% | Past Perf. 20% | Certs 10% (FAR 15.101-1)
              </div>
            </motion.div>
          </motion.div>

          {/* Feature highlights */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {[
              { icon: '📊', title: 'Side-by-Side', desc: 'Every sub, every SOW line item, one grid' },
              { icon: '🧠', title: 'AI Compliance Overlay', desc: 'Compliance scores integrated per quote' },
              { icon: '⚖️', title: 'Weighted Scoring', desc: 'FAR 15.101-1 best value evaluation' },
              { icon: '📥', title: 'Excel & PDF Export', desc: 'Source selection board-ready formats' },
            ].map((feat, i) => (
              <motion.div key={i} variants={fadeUp} className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                <div className="text-2xl mb-2">{feat.icon}</div>
                <div className="text-sm font-bold text-white mb-1">{feat.title}</div>
                <div className="text-xs text-blue-300/80">{feat.desc}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Metrics */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="flex justify-center gap-12 md:gap-20">
            {[
              { value: '4 Sheets', label: 'Excel Export' },
              { value: 'FAR', label: 'Compliant Scoring' },
              { value: 'Instant', label: 'Quote Comparison' },
              { value: 'PDF + XLSX', label: 'Export Formats' },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-white">{stat.value}</div>
                <div className="text-sm text-blue-300 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* GOVCON CAPTURE MANAGEMENT */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-emerald-950 via-teal-950 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 left-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} transition={{ duration: 0.5 }} className="text-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-emerald-200 mb-6">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" /></span>
              Full Shipley Capture Lifecycle
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Built for Government Capture Management
            </h2>
            <p className="text-lg text-emerald-200 max-w-3xl mx-auto leading-relaxed">
              The only platform that covers the full Shipley capture lifecycle — from opportunity qualification to post-award transition. Every tool a GovCon BD team needs, powered by AI.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-14">
            {[
              {
                icon: Award,
                title: 'Past Performance Library',
                desc: 'Upload CPARS reports and proposals — AI extracts contract details, ratings, and narratives. AI matches the most relevant citations to each project.',
              },
              {
                icon: ShieldCheck,
                title: 'Capture Gate Reviews',
                desc: 'Customizable Shipley-aligned gate reviews (Gate 0–4) with checklists, GO/NO-GO decisions, and org-wide templates.',
              },
              {
                icon: Briefcase,
                title: 'Contract Vehicle Registry',
                desc: 'Track GSA Schedules, OASIS, SEWP, and agency IDIQs with expiration dates, ceiling values, and NAICS scope.',
              },
              {
                icon: Palette,
                title: 'Color Team Reviews',
                desc: 'Structured Pink, Red, and Gold team reviews with findings, action items, reviewer tracking, and scoring.',
              },
              {
                icon: FileText,
                title: 'Section L/M Analysis',
                desc: 'AI extracts evaluation criteria, scoring methodology, and proposal structure requirements from RFP Section L & M.',
              },
              {
                icon: Scale,
                title: 'Price-to-Win Analysis',
                desc: 'AI-assisted pricing strategy using historical data, competitor positioning, and win probability scenarios.',
              },
              {
                icon: Search,
                title: 'Competitive Intelligence',
                desc: 'FPDS award history, incumbent analysis, and competitor profiling with strategic recommendations.',
              },
              {
                icon: ListChecks,
                title: 'SB Subcontracting Plans',
                desc: 'FAR 52.219-9 compliant plans with auto-calculated goals by SB category: SB, SDB, WOSB, HUBZone, SDVOSB.',
              },
              {
                icon: UserCheck,
                title: 'Personnel & LCAT Database',
                desc: 'Labor categories with rate ranges, key personnel directory with clearances, certifications, and availability tracking.',
              },
            ].map((item, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
                  <item.icon className="h-6 w-6 text-emerald-300" />
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-emerald-100 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-14">
            {[
              { value: 'Shipley', label: 'Gate Framework' },
              { value: 'AI-Powered', label: 'Past Performance Matching' },
              { value: 'FAR', label: 'Compliant SB Plans' },
              { value: 'FPDS', label: 'Market Intelligence' },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp} transition={{ duration: 0.4 }} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-white">{stat.value}</div>
                <div className="text-sm text-emerald-300 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
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
              { icon: Award, label: 'Past Performance Library' },
              { icon: ShieldCheck, label: 'Capture Gate Reviews' },
              { icon: Briefcase, label: 'Contract Vehicles' },
              { icon: Palette, label: 'Color Team Reviews' },
              { icon: UserCheck, label: 'Personnel & LCAT Database' },
              { icon: ListChecks, label: 'SB Subcontracting Plans' },
              { icon: Search, label: 'Competitive Intelligence' },
              { icon: Scale, label: 'Price-to-Win Analysis' },
              { icon: Contact2, label: 'Contact Management (CRM)' },
              { icon: CheckSquare, label: 'Task Assignments' },
              { icon: MessageSquare, label: 'Activity Feed & Comments' },
              { icon: Wand2, label: 'AI Proposal Drafting' },
              { icon: Bell, label: 'Slack & Email Notifications' },
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

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
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

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
            {PRICING_VISIBLE ? (
              <Link
                to="/pricing"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200"
              >
                View Pricing Plans
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : (
              <Link
                to="/contact"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200"
              >
                Contact Us
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* SUBCONTRACTOR NETWORK */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <p className="text-blue-300 text-sm font-bold uppercase tracking-wider mb-3">Built-In Network</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {stats.loading ? '...' : `${stats.total.toLocaleString()}+`} Subcontractors at Your Fingertips
              </h2>
              <p className="text-lg text-blue-200 max-w-2xl mx-auto leading-relaxed">
                The largest searchable database of government-registered subcontractors — sourced from SAM.gov, GSA eLibrary, and SBA databases. AI-matched to your SOW in seconds.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-12">
              {[
                { value: stats.loading ? '...' : `${stats.total.toLocaleString()}+`, label: 'Subcontractors' },
                { value: '45+', label: 'Trade Categories' },
                { value: '50', label: 'States Covered' },
                { value: stats.loading ? '...' : `${stats.smallBusiness.toLocaleString()}+`, label: 'Small Businesses' },
              ].map((stat, i) => (
                <motion.div key={i} variants={fadeUp} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-blue-200 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
              {[
                { icon: Brain, title: 'AI SOW Matching', desc: 'Upload your SOW — AI maps each line item to our 45-trade taxonomy and finds qualified subs by radius, region, or nationwide.' },
                { icon: Crosshair, title: 'Radius-Based Search', desc: 'Find subs within 10, 25, 50, or 200 miles of your project site. Combine Local + Regional + National scopes.' },
                { icon: Mail, title: 'RFQ Composer & Custom Domains', desc: 'Send branded RFQs from your own domain. Customize templates with merge fields — your brand, your reputation, your inbox.' },
              ].map((item, i) => (
                <div key={i} className="p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                  <item.icon className="h-8 w-8 text-blue-300 mb-3" />
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-blue-200 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} className="text-center">
              <Link
                to="/explore-network"
                className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold text-blue-900 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all"
              >
                Explore the Network
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
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
              to={PRICING_VISIBLE ? '/pricing' : '/demo'}
              className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all"
            >
              {SIGNUP_ENABLED ? 'Start Free Trial' : 'Request a Demo'}
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
