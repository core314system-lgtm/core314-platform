import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign, Users, TrendingUp, Brain, Shield,
  ArrowRight, Calculator, Building, FileText, BarChart3,
  Zap, Target, Layers, ChevronDown,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }

// --- Side-by-side comparison data ---
const comparisons = [
  {
    label: 'Proposal Manager',
    traditional: '$85K – $120K',
    tradValue: 102500,
    procuvex: 'AI Document Analysis + Compliance Matrix',
    icon: FileText,
  },
  {
    label: 'Contracts Administrator',
    traditional: '$70K – $95K',
    tradValue: 82500,
    procuvex: 'Auto-compliance verification & tracking',
    icon: Shield,
  },
  {
    label: 'Estimator / Pricing Analyst',
    traditional: '$75K – $110K',
    tradValue: 92500,
    procuvex: 'Pricing Decision Matrix + AI markup',
    icon: Calculator,
  },
  {
    label: 'Subcontractor Coordinator',
    traditional: '$55K – $75K',
    tradValue: 65000,
    procuvex: 'Automated RFQ + sub tracking',
    icon: Users,
  },
  {
    label: 'Administrative Support',
    traditional: '$40K – $55K',
    tradValue: 47500,
    procuvex: 'Auto-generated reports & exports',
    icon: Layers,
  },
]

// --- Feature value mapping ---
const featureValues = [
  { feature: 'AI Document Analysis', hours: '8–16 hrs', dollars: '$400–$800', desc: 'Reads 50–200 pages in seconds vs. days of manual review', icon: Brain },
  { feature: 'Compliance Matrix', hours: '6–12 hrs', dollars: '$300–$600', desc: 'Auto-maps every requirement — never miss a compliance item', icon: Shield },
  { feature: 'RFQ Automation', hours: '10–20 hrs', dollars: '$500–$1,000', desc: 'Send, track, and follow up with subs automatically', icon: Zap },
  { feature: 'Pricing Decision Matrix', hours: '8–15 hrs', dollars: '$400–$750', desc: 'Compare quotes, apply markups, model option years instantly', icon: DollarSign },
  { feature: 'Pipeline Management', hours: '4–8 hrs', dollars: '$200–$400', desc: 'Visual workflow from intake to award — nothing falls through cracks', icon: BarChart3 },
  { feature: 'Competitive Intelligence', hours: '5–10 hrs', dollars: '$250–$500', desc: 'Win/loss analysis that gets smarter with every bid', icon: Target },
]

// --- ROI Calculator ---
function ROICalculator() {
  const [bidsPerYear, setBidsPerYear] = useState(25)
  const [avgContractValue, setAvgContractValue] = useState(500000)
  const [teamSize, setTeamSize] = useState(5)

  const results = useMemo(() => {
    const hoursPerBidTraditional = 52 // midpoint of 32-72
    const hoursPerBidProcuvex = 3 // midpoint of 2-4
    const hoursSavedPerBid = hoursPerBidTraditional - hoursPerBidProcuvex
    const totalHoursSaved = hoursSavedPerBid * bidsPerYear
    const blendedRate = 65 // $/hr
    const timeSavingsDollars = totalHoursSaved * blendedRate

    const currentWinRate = 0.20
    const improvedWinRate = 0.30
    const currentBidCapacity = bidsPerYear
    const improvedBidCapacity = Math.round(bidsPerYear * 2.5)

    const currentRevenue = currentBidCapacity * currentWinRate * avgContractValue
    const projectedRevenue = improvedBidCapacity * improvedWinRate * avgContractValue
    const revenueUplift = projectedRevenue - currentRevenue

    const fteEquivalent = totalHoursSaved / 2080
    const personnelSavings = fteEquivalent * 95000 // avg fully-loaded cost

    const toolSavings = 15000 + (teamSize * 1200) // base + per-seat licenses
    const procuvexCost = 30000 // Growth plan annual
    const netSavings = timeSavingsDollars + toolSavings - procuvexCost
    const roi = Math.round((netSavings / procuvexCost) * 100)

    return {
      totalHoursSaved,
      daysSaved: Math.round(totalHoursSaved / 8),
      timeSavingsDollars,
      fteEquivalent: fteEquivalent.toFixed(1),
      personnelSavings: Math.round(personnelSavings),
      toolSavings,
      revenueUplift: Math.round(revenueUplift),
      improvedBidCapacity,
      netSavings: Math.round(netSavings),
      roi,
      procuvexCost,
    }
  }, [bidsPerYear, avgContractValue, teamSize])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Calculator size={24} /> ROI Calculator
        </h3>
        <p className="text-blue-100 text-sm mt-1">Enter your numbers to see projected savings</p>
      </div>

      {/* Inputs */}
      <div className="px-8 py-8 border-b border-slate-100">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Bids Per Year</label>
            <input
              type="range" min="5" max="200" step="5"
              value={bidsPerYear} onChange={e => setBidsPerYear(+e.target.value)}
              className="w-full accent-blue-600"
            />
            <p className="text-center text-2xl font-bold text-blue-600 mt-2">{bidsPerYear}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Avg Contract Value</label>
            <input
              type="range" min="50000" max="5000000" step="50000"
              value={avgContractValue} onChange={e => setAvgContractValue(+e.target.value)}
              className="w-full accent-blue-600"
            />
            <p className="text-center text-2xl font-bold text-blue-600 mt-2">${(avgContractValue / 1000).toFixed(0)}K</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Team Size</label>
            <input
              type="range" min="1" max="50" step="1"
              value={teamSize} onChange={e => setTeamSize(+e.target.value)}
              className="w-full accent-blue-600"
            />
            <p className="text-center text-2xl font-bold text-blue-600 mt-2">{teamSize} people</p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-8 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Hours Saved/Year</p>
            <p className="text-3xl font-bold text-green-800 mt-1">{results.totalHoursSaved.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1">{results.daysSaved} working days</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Time Savings Value</p>
            <p className="text-3xl font-bold text-blue-800 mt-1">${results.timeSavingsDollars.toLocaleString()}</p>
            <p className="text-xs text-blue-600 mt-1">@ $65/hr blended rate</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">FTE Equivalent</p>
            <p className="text-3xl font-bold text-purple-800 mt-1">{results.fteEquivalent}</p>
            <p className="text-xs text-purple-600 mt-1">full-time positions</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Revenue Uplift</p>
            <p className="text-3xl font-bold text-amber-800 mt-1">${(results.revenueUplift / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-amber-600 mt-1">from higher volume + win rate</p>
          </div>
        </div>

        <div className="mt-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-slate-400 text-sm">Net Annual Savings (after Procuvex cost)</p>
              <p className="text-4xl font-bold mt-1">${results.netSavings.toLocaleString()}<span className="text-lg text-slate-400">/year</span></p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-sm">Return on Investment</p>
              <p className="text-4xl font-bold text-green-400 mt-1">{results.roi}%</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-sm">
            <span className="text-slate-400">Procuvex investment: ${results.procuvexCost.toLocaleString()}/yr</span>
            <span className="text-slate-400">Increased bid capacity: {results.improvedBidCapacity} bids/yr</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Scaling Chart (visual) ---
function ScalingVisual() {
  const bidLevels = [10, 25, 50, 100]

  return (
    <div className="grid sm:grid-cols-2 gap-8">
      {/* Traditional */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Traditional: Cost Grows with Volume</h4>
        <div className="space-y-4">
          {bidLevels.map(bids => {
            const cost = 250000 + (bids * 4000)
            const width = Math.min((cost / 700000) * 100, 100)
            return (
              <div key={bids}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{bids} bids/yr</span>
                  <span className="font-semibold">${(cost / 1000).toFixed(0)}K</span>
                </div>
                <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: `${width}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    viewport={{ once: true }}
                    className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Procuvex */}
      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
        <h4 className="text-lg font-bold text-slate-900 mb-4">Procuvex: Fixed Cost, Infinite Scale</h4>
        <div className="space-y-4">
          {bidLevels.map(bids => {
            const cost = 30000 // Fixed
            const width = Math.min((cost / 700000) * 100, 8) // Stays small
            return (
              <div key={bids}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{bids} bids/yr</span>
                  <span className="font-semibold text-blue-700">$30K</span>
                </div>
                <div className="h-4 bg-blue-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} whileInView={{ width: `${width}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    viewport={{ once: true }}
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// --- FAQ ---
const faqs = [
  { q: 'How are the savings calculated?', a: 'Savings are based on industry salary data (Bureau of Labor Statistics, Glassdoor, Indeed), average bid processing times from government contracting firms, and standard employer overhead rates (benefits, taxes, insurance at ~30% of salary). Actual results vary by firm size, market, and bid complexity.' },
  { q: 'Does Procuvex replace my entire team?', a: 'No. Procuvex augments your team by automating repetitive tasks — document analysis, compliance mapping, pricing spreadsheets, RFQ outreach. Your people are freed to focus on strategy, relationships, and winning. Most firms reallocate 1-3 FTEs to higher-value work rather than eliminating positions.' },
  { q: 'What if I only do a few bids per year?', a: 'Even at 10 bids per year, Procuvex saves 300-680 hours annually. For smaller firms, the biggest value is often tool consolidation (replacing 5-10 separate tools) and institutional knowledge capture (your bid intelligence doesn\'t walk out the door when someone leaves).' },
  { q: 'How quickly will I see ROI?', a: 'Most firms see positive ROI within their first 2-3 bids. The AI document analysis alone saves 8-16 hours per bid. By your 5th bid, the platform\'s self-learning intelligence begins providing competitive pricing insights that directly improve win rates.' },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="text-base font-semibold text-slate-900 pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-5 pr-8"><p className="text-sm text-slate-600 leading-relaxed">{a}</p></div>}
    </div>
  )
}

// --- Main Page ---
export default function ROIPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-3">
              Why Procuvex
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900"
            >
              Replace <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-600">$400K+</span> in overhead{' '}
              <br className="hidden sm:block" />for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">$2,500/month</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto"
            >
              Government contracting firms spend hundreds of thousands on bid management staff, tools, and overhead. Procuvex replaces that infrastructure with AI — delivering 5–10x ROI while you submit more bids and win more often.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <a href="#calculator" className="px-8 py-3.5 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-600/25 transition-all">
                Calculate Your ROI
              </a>
              <Link to="/pricing" className="px-8 py-3.5 text-base font-bold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-xl transition-all">
                View Pricing
              </Link>
            </motion.div>
          </div>

          {/* Stat counters */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
          >
            {[
              { value: '15–30x', label: 'Faster bid processing', color: 'blue' },
              { value: '53–104', label: 'Hours saved per bid', color: 'green' },
              { value: '5–10x', label: 'Return on investment', color: 'purple' },
              { value: '2–3x', label: 'More bids submitted', color: 'amber' },
            ].map(stat => (
              <div key={stat.label} className={`text-center p-5 rounded-xl bg-${stat.color}-50 border border-${stat.color}-100`}>
                <p className={`text-2xl sm:text-3xl font-extrabold text-${stat.color}-600`}>{stat.value}</p>
                <p className="text-xs text-slate-600 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Side-by-side: Traditional vs Procuvex */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">What You Pay Today vs. Procuvex</h2>
            <p className="text-slate-600 mt-3 max-w-2xl mx-auto">Most firms employ 3–5 people just to manage their bid pipeline. Procuvex handles the heavy lifting.</p>
          </motion.div>

          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <div className="col-span-4">Role</div>
              <div className="col-span-3 text-center">Traditional Cost</div>
              <div className="col-span-5">Procuvex Replacement</div>
            </div>

            {comparisons.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.label}
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="grid grid-cols-12 gap-4 items-center bg-slate-50 rounded-xl p-4 border border-slate-100"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="bg-red-100 rounded-lg p-2 hidden sm:block"><Icon size={18} className="text-red-600" /></div>
                    <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                  </div>
                  <div className="col-span-3 text-center">
                    <span className="text-sm font-bold text-red-600">{item.traditional}</span>
                    <span className="text-xs text-slate-500 block">/year</span>
                  </div>
                  <div className="col-span-5 flex items-center gap-2">
                    <div className="bg-blue-100 rounded-lg p-2 hidden sm:block"><Icon size={18} className="text-blue-600" /></div>
                    <span className="text-sm text-blue-700 font-medium">{item.procuvex}</span>
                  </div>
                </motion.div>
              )
            })}

            {/* Total row */}
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="grid grid-cols-12 gap-4 items-center bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white"
            >
              <div className="col-span-4">
                <span className="text-sm font-bold">Total Annual Cost</span>
                <span className="text-xs text-slate-400 block">+ 30% employer overhead</span>
              </div>
              <div className="col-span-3 text-center">
                <span className="text-lg font-extrabold text-red-400">$437K – $617K</span>
              </div>
              <div className="col-span-5">
                <span className="text-lg font-extrabold text-green-400">$24K – $48K</span>
                <span className="text-xs text-slate-400 block">Procuvex Growth or Enterprise plan</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature → Value Mapping */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Every Feature Saves Real Time & Money</h2>
            <p className="text-slate-600 mt-3 max-w-2xl mx-auto">Per-bid savings across key platform capabilities</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {featureValues.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.feature}
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-100 rounded-lg p-2"><Icon size={20} className="text-blue-600" /></div>
                    <h4 className="font-bold text-slate-900">{item.feature}</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{item.desc}</p>
                  <div className="flex gap-4">
                    <div className="bg-green-50 rounded-lg px-3 py-1.5">
                      <p className="text-xs text-green-700 font-semibold">{item.hours} saved</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                      <p className="text-xs text-blue-700 font-semibold">{item.dollars}/bid</p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Interactive ROI Calculator */}
      <section id="calculator" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Calculate Your ROI</h2>
            <p className="text-slate-600 mt-3 max-w-2xl mx-auto">Adjust the sliders to match your firm. See exactly how much Procuvex saves you.</p>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <ROICalculator />
          </motion.div>
        </div>
      </section>

      {/* Scaling Visual */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Scale Without Hiring</h2>
            <p className="text-slate-600 mt-3 max-w-2xl mx-auto">Traditional teams grow linearly with bid volume. Procuvex stays flat — handle 2x, 5x, 10x more bids at the same cost.</p>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <ScalingVisual />
          </motion.div>
        </div>
      </section>

      {/* Institutional Knowledge */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-8 sm:p-12 text-white">
                <div className="flex items-start gap-4 mb-6">
                  <div className="bg-white/20 rounded-xl p-3"><Brain size={32} /></div>
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold">Your Company's Permanent Memory</h3>
                    <p className="text-blue-100 mt-2">When a senior bid manager leaves, they take years of institutional knowledge with them. Procuvex captures everything permanently.</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    'Pricing history for every project type',
                    'Competitor patterns and tendencies',
                    'Subcontractor reliability scores',
                    'Win/loss analysis and lessons learned',
                    'Markup strategies that actually win',
                    'Gets smarter with every single bid',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                      <span className="text-sm text-blue-50">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-white/20">
                  <p className="text-sm text-blue-200 italic">"Replacing institutional knowledge when someone leaves costs $50K–$100K+ in lost productivity during ramp-up. Procuvex eliminates this risk entirely."</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Who Benefits Most */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Built for Every Size — Scaled for the Largest</h2>
            <p className="text-slate-600 mt-3 max-w-2xl mx-auto">From 5-person shops to 500+ employee primes, Procuvex delivers compounding value as your operation grows.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { title: 'Large Primes & Enterprise', desc: 'Unify bid intelligence across divisions, eliminate duplicated effort, and enforce consistent pricing strategy across hundreds of pursuits per year', icon: Building, color: 'blue' },
              { title: 'Multi-Office & Multi-Division', desc: 'Centralized bid intelligence across every office and business unit — one source of truth for pricing, subs, and competitive data', icon: Layers, color: 'indigo' },
              { title: 'JV Partners & Teaming Leads', desc: 'Coordinate subcontractor outreach, track teaming agreements, and manage pricing across complex joint venture structures', icon: Users, color: 'green' },
              { title: 'Mid-Size Firms (15–100+)', desc: 'Multiply your proposal team\'s capacity 3–5x without adding headcount — submit more bids, win more contracts', icon: TrendingUp, color: 'purple' },
              { title: 'High-Growth & Acquisition', desc: 'Retain institutional knowledge through mergers, acquisitions, and rapid growth — onboard new teams instantly with AI-captured bid history', icon: Brain, color: 'amber' },
              { title: 'Emerging & Small Firms', desc: 'Compete with firms 10x your size — Procuvex gives a 5-person team the bid management power of a full proposal department', icon: Target, color: 'cyan' },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.title}
                  variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-white rounded-xl border border-slate-200 p-6"
                >
                  <div className={`bg-${item.color}-100 rounded-lg p-2 w-fit mb-3`}>
                    <Icon size={20} className={`text-${item.color}-600`} />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                  <p className="text-sm text-slate-600">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
          </motion.div>
          <div>
            {faqs.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              The question isn't whether you can afford Procuvex.
              <br />
              <span className="text-blue-200">It's whether you can afford not to have it.</span>
            </h2>
            <p className="text-blue-100 mt-4 text-lg">Start your 7-day free trial. No commitment. Full access to every feature.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/pricing"
                className="px-8 py-3.5 text-base font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all inline-flex items-center gap-2"
              >
                Start Free Trial <ArrowRight size={18} />
              </Link>
              <Link
                to="/contact"
                className="px-8 py-3.5 text-base font-bold text-white border-2 border-white/30 hover:border-white/60 rounded-xl transition-all"
              >
                Talk to Sales
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
