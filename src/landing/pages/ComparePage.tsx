import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, X, Minus, Shield, Zap,
  DollarSign, Clock, Users, Brain,
  BarChart3, Target,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.06 } } }

type FeatureStatus = 'yes' | 'no' | 'partial' | 'limited'

interface ComparisonData {
  slug: string
  competitor: string
  tagline: string
  heroDescription: string
  priceComparison: { procuvex: string; competitor: string }
  targetAudience: { procuvex: string; competitor: string }
  summary: string[]
  features: Array<{
    category: string
    items: Array<{
      feature: string
      procuvex: FeatureStatus
      competitor: FeatureStatus
      note?: string
    }>
  }>
  whySwitch: Array<{ title: string; desc: string; icon: typeof Shield }>
}

const comparisons: Record<string, ComparisonData> = {
  'govwin': {
    slug: 'govwin',
    competitor: 'Deltek GovWin IQ',
    tagline: 'Enterprise Power at 1/10th the Price',
    heroDescription: 'GovWin IQ is the 30-year incumbent — powerful but expensive and complex. Procuvex delivers AI-powered analysis, compliance automation, and opportunity discovery purpose-built for small and mid-size contractors who need results without a six-figure contract.',
    priceComparison: { procuvex: '$2,500/mo', competitor: '$10,000–$50,000+/year' },
    targetAudience: { procuvex: 'Small & mid-size contractors ($1M–$100M)', competitor: 'Large primes & enterprises ($100M+)' },
    summary: [
      'Procuvex is 60–90% cheaper than GovWin IQ with comparable opportunity discovery',
      'AI-powered document analysis is built-in — GovWin requires separate tools for proposal work',
      'Procuvex includes compliance matrix automation, which GovWin does not offer',
      'GovWin has a deeper historical database spanning 30+ years',
      'Procuvex is purpose-built for the modern AI-first workflow',
    ],
    features: [
      {
        category: 'Opportunity Discovery',
        items: [
          { feature: 'SAM.gov opportunity feed', procuvex: 'yes', competitor: 'yes' },
          { feature: 'AI match scoring against company profile', procuvex: 'yes', competitor: 'partial', note: 'GovWin uses keyword alerts, not AI scoring' },
          { feature: 'Set-aside / socioeconomic filtering', procuvex: 'yes', competitor: 'yes' },
          { feature: 'State & local opportunities', procuvex: 'no', competitor: 'yes', note: 'GovWin covers state/local; Procuvex focuses on federal' },
          { feature: 'Historical win/loss data', procuvex: 'limited', competitor: 'yes', note: 'GovWin has 30+ years of award history' },
          { feature: 'Deadline tracking & urgency alerts', procuvex: 'yes', competitor: 'partial' },
        ],
      },
      {
        category: 'Proposal & Analysis',
        items: [
          { feature: 'AI document analysis (SOW/RFP parsing)', procuvex: 'yes', competitor: 'no' },
          { feature: 'Compliance matrix auto-generation', procuvex: 'yes', competitor: 'no' },
          { feature: 'FAR/DFARS clause identification', procuvex: 'yes', competitor: 'no' },
          { feature: 'Pricing risk analysis', procuvex: 'yes', competitor: 'no' },
          { feature: 'Executive summary generation', procuvex: 'yes', competitor: 'no' },
          { feature: 'Bid/no-bid decision engine', procuvex: 'yes', competitor: 'partial' },
        ],
      },
      {
        category: 'Team & Subcontractor Management',
        items: [
          { feature: 'Subcontractor search (SAM.gov data)', procuvex: 'yes', competitor: 'limited' },
          { feature: 'RFQ package generation & distribution', procuvex: 'yes', competitor: 'no' },
          { feature: 'Quote comparison across subs', procuvex: 'yes', competitor: 'no' },
          { feature: 'Subcontractor portal for bid responses', procuvex: 'yes', competitor: 'no' },
          { feature: 'Teaming agreement tracking', procuvex: 'yes', competitor: 'partial' },
        ],
      },
      {
        category: 'Workflow & Pipeline',
        items: [
          { feature: 'Kanban pipeline view', procuvex: 'yes', competitor: 'yes' },
          { feature: 'Multi-stage workflow (intake → award)', procuvex: 'yes', competitor: 'yes' },
          { feature: 'Post-award debrief system', procuvex: 'yes', competitor: 'no' },
          { feature: 'Export to PDF/PPTX/Excel', procuvex: 'yes', competitor: 'partial' },
          { feature: 'Contract management', procuvex: 'yes', competitor: 'yes' },
        ],
      },
    ],
    whySwitch: [
      { title: 'Save $7,500–$47,500/year', desc: 'Procuvex at $2,500/mo ($30K/yr) delivers more automation than GovWin IQ at $10K–$50K+/yr. Your ROI is immediate.', icon: DollarSign },
      { title: 'AI Does the Analysis', desc: 'GovWin helps you find opportunities. Procuvex helps you find them AND win them — with AI-powered document analysis, compliance automation, and pricing intelligence.', icon: Brain },
      { title: 'Built for Small Business', desc: 'GovWin was designed for Lockheed Martin and Raytheon. Procuvex is designed for the $5M–$50M contractor who needs to punch above their weight.', icon: Target },
      { title: 'One Platform, Not Five', desc: 'GovWin users typically need separate tools for proposals (Capture2Proposal), compliance (Excel), subcontractors (manual), and pricing (spreadsheets). Procuvex replaces all of them.', icon: Zap },
    ],
  },
  'spreadsheets': {
    slug: 'spreadsheets',
    competitor: 'Spreadsheets & Manual Process',
    tagline: 'Stop Losing Bids to Copy-Paste Errors',
    heroDescription: 'Most small government contractors manage their entire bid process in Excel and Word. It works — until it doesn\'t. Missed requirements, outdated pricing, and scattered subcontractor quotes cost contracts. Procuvex eliminates the manual work.',
    priceComparison: { procuvex: '$2,500/mo', competitor: 'Free (+ 80+ hours/month of labor)' },
    targetAudience: { procuvex: 'Contractors bidding 3+ opportunities/month', competitor: 'Contractors bidding 1–2 opportunities/month' },
    summary: [
      'The average proposal takes 40–80 hours with spreadsheets — Procuvex cuts this by 50–70%',
      'Compliance tracking in Excel is error-prone; one missed requirement = non-responsive bid',
      'Procuvex automates the most tedious parts: requirement extraction, compliance mapping, pricing analysis',
      'Spreadsheets have zero cost but massive hidden costs in time, errors, and missed deadlines',
      'Procuvex pays for itself if it helps you win just one additional contract per year',
    ],
    features: [
      {
        category: 'Opportunity Discovery',
        items: [
          { feature: 'Automated SAM.gov opportunity feed', procuvex: 'yes', competitor: 'no', note: 'Manual SAM.gov searches' },
          { feature: 'AI match scoring', procuvex: 'yes', competitor: 'no' },
          { feature: 'Deadline tracking with alerts', procuvex: 'yes', competitor: 'partial', note: 'Calendar reminders if you remember to set them' },
          { feature: 'One-click import to pipeline', procuvex: 'yes', competitor: 'no', note: 'Manual copy-paste from SAM.gov' },
        ],
      },
      {
        category: 'Document Analysis',
        items: [
          { feature: 'AI extracts requirements from RFP/SOW', procuvex: 'yes', competitor: 'no', note: 'Manual line-by-line reading' },
          { feature: 'Compliance matrix auto-generation', procuvex: 'yes', competitor: 'no', note: 'Manual Excel matrix' },
          { feature: 'FAR/DFARS clause detection', procuvex: 'yes', competitor: 'no', note: 'Manual clause-by-clause review' },
          { feature: 'Risk identification', procuvex: 'yes', competitor: 'no', note: 'Relies on experience' },
          { feature: 'Version tracking', procuvex: 'yes', competitor: 'partial', note: 'File naming conventions' },
        ],
      },
      {
        category: 'Subcontractor Management',
        items: [
          { feature: 'Searchable sub database from SAM.gov', procuvex: 'yes', competitor: 'no', note: 'Rolodex / personal network' },
          { feature: 'RFQ generation and email distribution', procuvex: 'yes', competitor: 'no', note: 'Manual emails with attachments' },
          { feature: 'Quote comparison across vendors', procuvex: 'yes', competitor: 'partial', note: 'Manual spreadsheet comparison' },
          { feature: 'Sub portal for receiving quotes', procuvex: 'yes', competitor: 'no' },
        ],
      },
      {
        category: 'Reporting & Output',
        items: [
          { feature: 'Executive summary generation', procuvex: 'yes', competitor: 'no', note: 'Manual writing' },
          { feature: 'PDF/PPTX/Excel export', procuvex: 'yes', competitor: 'partial', note: 'Manual formatting' },
          { feature: 'Pipeline analytics', procuvex: 'yes', competitor: 'partial', note: 'Manual tracking' },
          { feature: 'Win/loss tracking with debriefs', procuvex: 'yes', competitor: 'no', note: 'Informal notes' },
        ],
      },
    ],
    whySwitch: [
      { title: 'Save 30–50 Hours Per Proposal', desc: 'AI extracts requirements, builds compliance matrices, identifies risks, and generates summaries. You review instead of building from scratch.', icon: Clock },
      { title: 'Never Miss a Requirement', desc: 'Spreadsheet compliance matrices have gaps. Procuvex\'s AI reads every page of the RFP and flags every "shall," "must," and "required" — automatically.', icon: Shield },
      { title: 'Win More With Better Proposals', desc: 'When you spend 50% less time on admin work, you spend 50% more time on strategy, pricing, and the technical approach that actually wins.', icon: BarChart3 },
      { title: 'ROI After One Win', desc: 'At $2,500/mo, Procuvex costs $30K/year. One additional contract win — even a small $100K task order — pays for itself 3x over.', icon: DollarSign },
    ],
  },
  'govly': {
    slug: 'govly',
    competitor: 'Govly',
    tagline: 'Find Opportunities AND Win Them',
    heroDescription: 'Govly is great at opportunity discovery and teaming. But once you find a bid, you still need separate tools to analyze it, build compliance matrices, price it, and manage subcontractors. Procuvex is the complete workflow — from discovery to award.',
    priceComparison: { procuvex: '$2,500/mo (all features)', competitor: 'Free tier + paid plans' },
    targetAudience: { procuvex: 'Contractors who need end-to-end bid management', competitor: 'Contractors focused on opportunity discovery & teaming' },
    summary: [
      'Govly excels at opportunity discovery and the "market network" for GovCon teaming',
      'Procuvex goes deeper: AI document analysis, compliance automation, pricing, and subcontractor management',
      'The two tools are complementary — use Govly to find opportunities, Procuvex to win them',
      'Procuvex now includes its own SAM.gov opportunity feed with AI match scoring',
      'Procuvex is the only platform that auto-generates compliance matrices from RFP documents',
    ],
    features: [
      {
        category: 'Opportunity Discovery',
        items: [
          { feature: 'SAM.gov opportunity feed', procuvex: 'yes', competitor: 'yes' },
          { feature: 'AI match scoring', procuvex: 'yes', competitor: 'yes' },
          { feature: 'Market network / community', procuvex: 'no', competitor: 'yes', note: 'Govly has a community marketplace for teaming' },
          { feature: 'Pre-RFP intelligence / buying signals', procuvex: 'no', competitor: 'partial' },
          { feature: 'Import opportunity to pipeline', procuvex: 'yes', competitor: 'partial' },
        ],
      },
      {
        category: 'AI-Powered Analysis',
        items: [
          { feature: 'SOW/RFP document parsing', procuvex: 'yes', competitor: 'no' },
          { feature: 'Compliance matrix generation', procuvex: 'yes', competitor: 'no' },
          { feature: 'FAR/DFARS identification', procuvex: 'yes', competitor: 'no' },
          { feature: 'Pricing risk analysis', procuvex: 'yes', competitor: 'no' },
          { feature: 'Bid/no-bid decision engine', procuvex: 'yes', competitor: 'no' },
          { feature: 'Executive summary AI', procuvex: 'yes', competitor: 'no' },
        ],
      },
      {
        category: 'Proposal Workflow',
        items: [
          { feature: 'Kanban pipeline management', procuvex: 'yes', competitor: 'partial' },
          { feature: 'Subcontractor RFQ packages', procuvex: 'yes', competitor: 'no' },
          { feature: 'Quote management & comparison', procuvex: 'yes', competitor: 'no' },
          { feature: 'Subcontractor portal', procuvex: 'yes', competitor: 'no' },
          { feature: 'Post-award debriefing', procuvex: 'yes', competitor: 'no' },
          { feature: 'Export (PDF/PPTX/Excel)', procuvex: 'yes', competitor: 'no' },
        ],
      },
      {
        category: 'Team Collaboration',
        items: [
          { feature: 'Teaming partner discovery', procuvex: 'yes', competitor: 'yes', note: 'Govly has a stronger teaming marketplace' },
          { feature: 'AI-powered capture agents', procuvex: 'partial', competitor: 'yes', note: 'Govly offers AI agents for capture management' },
          { feature: 'Multi-org collaboration', procuvex: 'limited', competitor: 'yes' },
          { feature: 'Subcontractor SAM.gov capture', procuvex: 'yes', competitor: 'no' },
          { feature: 'Contact/relationship management', procuvex: 'yes', competitor: 'no' },
          { feature: 'Project task assignments', procuvex: 'yes', competitor: 'no' },
          { feature: 'Activity feed & comments', procuvex: 'yes', competitor: 'no' },
          { feature: 'AI proposal draft generation', procuvex: 'yes', competitor: 'no' },
          { feature: 'Slack integration', procuvex: 'yes', competitor: 'no' },
        ],
      },
    ],
    whySwitch: [
      { title: 'Complete Workflow', desc: 'Govly helps you find opportunities. Procuvex helps you find, analyze, price, staff, and win them. One platform replaces your entire bid management stack.', icon: Zap },
      { title: 'AI Document Analysis', desc: 'Upload an RFP and get a compliance matrix, risk assessment, pricing analysis, and executive summary in minutes. No other GovCon platform does this.', icon: Brain },
      { title: 'Subcontractor Operations', desc: 'Generate RFQ packages, distribute to subs, receive quotes through a portal, and compare pricing — all without leaving the platform.', icon: Users },
      { title: 'Use Both Together', desc: 'Govly and Procuvex aren\'t mutually exclusive. Use Govly for its market network and teaming features, and Procuvex for analysis, compliance, and bid management.', icon: Target },
    ],
  },
}

function StatusIcon({ status }: { status: FeatureStatus }) {
  switch (status) {
    case 'yes':
      return <CheckCircle className="w-5 h-5 text-green-500" />
    case 'no':
      return <X className="w-5 h-5 text-red-400" />
    case 'partial':
      return <Minus className="w-5 h-5 text-amber-500" />
    case 'limited':
      return <Minus className="w-5 h-5 text-slate-400" />
  }
}

function statusLabel(status: FeatureStatus) {
  switch (status) {
    case 'yes': return 'Full support'
    case 'no': return 'Not available'
    case 'partial': return 'Partial'
    case 'limited': return 'Limited'
  }
}

export default function ComparePage() {
  const { competitor } = useParams<{ competitor: string }>()
  const data = comparisons[competitor || '']

  if (!data) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="pt-28 pb-16 max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Compare Procuvex</h1>
          <p className="text-slate-600 mb-10">See how Procuvex stacks up against the alternatives.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {Object.values(comparisons).map(c => (
              <Link
                key={c.slug}
                to={`/compare/${c.slug}`}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <h3 className="font-bold text-slate-900 mb-2">vs {c.competitor}</h3>
                <p className="text-sm text-slate-500">{c.tagline}</p>
                <div className="mt-4 text-xs text-blue-600 font-medium flex items-center gap-1">
                  View comparison <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-6">
              Comparison
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
              Procuvex vs {data.competitor}
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-blue-600 font-semibold mb-4">
              {data.tagline}
            </motion.p>
            <motion.p variants={fadeUp} className="text-slate-600 max-w-2xl mx-auto mb-8">
              {data.heroDescription}
            </motion.p>

            {/* Price comparison */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto mb-8">
              <div className="flex-1 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="text-xs text-blue-600 font-semibold mb-1">Procuvex</div>
                <div className="text-xl font-bold text-slate-900">{data.priceComparison.procuvex}</div>
                <div className="text-xs text-slate-500 mt-1">{data.targetAudience.procuvex}</div>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 font-semibold mb-1">{data.competitor}</div>
                <div className="text-xl font-bold text-slate-900">{data.priceComparison.competitor}</div>
                <div className="text-xs text-slate-500 mt-1">{data.targetAudience.competitor}</div>
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Key Takeaways */}
      <section className="py-12 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Key Takeaways</h3>
          <ul className="space-y-2">
            {data.summary.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              Feature-by-Feature Comparison
            </motion.h2>

            <div className="space-y-8">
              {data.features.map(category => (
                <motion.div key={category.category} variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900 text-sm">{category.category}</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {/* Header row */}
                    <div className="grid grid-cols-12 px-6 py-2 bg-slate-50/50">
                      <div className="col-span-6 text-xs font-semibold text-slate-400 uppercase">Feature</div>
                      <div className="col-span-3 text-xs font-semibold text-blue-600 uppercase text-center">Procuvex</div>
                      <div className="col-span-3 text-xs font-semibold text-slate-400 uppercase text-center">{data.competitor.split(' ')[0]}</div>
                    </div>
                    {category.items.map((item, i) => (
                      <div key={i} className="grid grid-cols-12 px-6 py-3 items-center">
                        <div className="col-span-6">
                          <div className="text-sm text-slate-700">{item.feature}</div>
                          {item.note && <div className="text-xs text-slate-400 mt-0.5">{item.note}</div>}
                        </div>
                        <div className="col-span-3 flex justify-center" title={statusLabel(item.procuvex)}>
                          <StatusIcon status={item.procuvex} />
                        </div>
                        <div className="col-span-3 flex justify-center" title={statusLabel(item.competitor)}>
                          <StatusIcon status={item.competitor} />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why Switch */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-10 text-center">
              Why Teams Choose Procuvex
            </motion.h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.whySwitch.map(reason => (
                <motion.div key={reason.title} variants={fadeUp} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                    <reason.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{reason.title}</h3>
                  <p className="text-sm text-slate-600">{reason.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Other comparisons */}
      <section className="py-12 border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">Other Comparisons</h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {Object.values(comparisons).filter(c => c.slug !== data.slug).map(c => (
              <Link
                key={c.slug}
                to={`/compare/${c.slug}`}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-all"
              >
                vs {c.competitor}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              Ready to See the Difference?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-600 max-w-lg mx-auto mb-8">
              Start a free trial and see why contractors are switching to Procuvex for their bid management workflow.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
              >
                Talk to Us
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
