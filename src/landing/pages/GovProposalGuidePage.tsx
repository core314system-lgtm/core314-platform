import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Shield, FileText,
  Target, BookOpen,
  Zap, BarChart3,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const checklist = [
  {
    phase: 'Before You Bid',
    icon: Target,
    color: 'blue',
    items: [
      { task: 'Verify your SAM.gov registration is active and current', critical: true },
      { task: 'Confirm your NAICS codes match the solicitation', critical: true },
      { task: 'Check set-aside eligibility (8(a), HUBZone, SDVOSB, WOSB)', critical: true },
      { task: 'Review your past performance — do you have 3 relevant references?', critical: false },
      { task: 'Run a bid/no-bid analysis based on win probability', critical: false },
      { task: 'Identify teaming partners or subcontractors if needed', critical: false },
      { task: 'Verify you meet all mandatory qualifications (clearances, certifications)', critical: true },
    ],
  },
  {
    phase: 'Proposal Preparation',
    icon: FileText,
    color: 'indigo',
    items: [
      { task: 'Read the ENTIRE solicitation — every section, every attachment', critical: true },
      { task: 'Build a compliance matrix mapping every requirement to your response', critical: true },
      { task: 'Create a proposal outline matching Section L instructions exactly', critical: true },
      { task: 'Identify all FAR/DFARS clauses and their compliance requirements', critical: false },
      { task: 'Draft technical approach with specific methodology, not generic language', critical: false },
      { task: 'Prepare management plan with org chart and key personnel resumes', critical: false },
      { task: 'Develop pricing using government-accepted formats (SF 1449, etc.)', critical: true },
      { task: 'Include all required representations and certifications', critical: true },
    ],
  },
  {
    phase: 'Review & Submit',
    icon: Shield,
    color: 'green',
    items: [
      { task: 'Red team review — have someone who didn\'t write it read for gaps', critical: true },
      { task: 'Compliance check — verify every requirement in the matrix is addressed', critical: true },
      { task: 'Price reasonableness check — is your pricing competitive but realistic?', critical: false },
      { task: 'Format check — page limits, font size, margins per Section L', critical: true },
      { task: 'Submit at least 24 hours before deadline (system issues happen)', critical: true },
      { task: 'Confirm receipt — get submission confirmation from SAM.gov/agency', critical: true },
      { task: 'Save a complete copy of your submission for debriefing', critical: false },
    ],
  },
  {
    phase: 'After Submission',
    icon: BarChart3,
    color: 'amber',
    items: [
      { task: 'Track award timeline — most solicitations specify expected award date', critical: false },
      { task: 'Respond promptly to any Evaluation Notices (ENs) or clarification requests', critical: true },
      { task: 'If not awarded, request a debriefing within 3 days of notification', critical: true },
      { task: 'Document lessons learned for future proposals', critical: false },
      { task: 'Update your past performance database with results', critical: false },
    ],
  },
]

const keyTerms = [
  { term: 'FAR', definition: 'Federal Acquisition Regulation — the rulebook for federal procurement. Every government contract is governed by these rules.' },
  { term: 'DFARS', definition: 'Defense Federal Acquisition Regulation Supplement — additional rules specific to Department of Defense contracts.' },
  { term: 'NAICS Code', definition: 'North American Industry Classification System — 6-digit codes that categorize your business type. You must match the solicitation\'s NAICS code.' },
  { term: 'Set-Aside', definition: 'Contracts reserved for specific small business categories: 8(a), HUBZone, Service-Disabled Veteran-Owned (SDVOSB), Women-Owned (WOSB).' },
  { term: 'SAM.gov', definition: 'System for Award Management — the federal government\'s official portal for contract opportunities. Registration is mandatory to bid.' },
  { term: 'SOW / PWS', definition: 'Statement of Work / Performance Work Statement — describes what the government needs you to do. The core of every solicitation.' },
  { term: 'Section L & M', definition: 'Section L = proposal submission instructions. Section M = how proposals will be evaluated. These two sections determine how you write and what wins.' },
  { term: 'IDIQ', definition: 'Indefinite Delivery, Indefinite Quantity — a contract type with a ceiling value but individual task orders issued over time.' },
  { term: 'Past Performance', definition: 'Your track record on similar contracts. Evaluated by checking references and CPARS (Contractor Performance Assessment Reporting System).' },
  { term: 'LPTA vs Best Value', definition: 'Lowest Price Technically Acceptable vs Best Value — LPTA awards to the cheapest compliant bid; Best Value weighs quality against price.' },
]

const stats = [
  { value: '$760B+', label: 'Federal procurement spending (FY2026)' },
  { value: '23%', label: 'Set aside for small businesses (~$175B)' },
  { value: '300K+', label: 'Registered contractors on SAM.gov' },
  { value: '90%', label: 'Win zero contracts in their first year' },
]

export default function GovProposalGuidePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              Complete Guide
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
              Small Business{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
                Government Contracting
              </span>{' '}
              Guide
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              Everything you need to know to win your first — or your fiftieth — government contract. 
              From SAM.gov registration to proposal submission to post-award debriefing.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-xl transition-all"
              >
                Try Procuvex Free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Market Stats */}
      <section className="py-12 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proposal Checklist */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-2 text-center">
              Government Proposal Checklist
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 text-center mb-12 max-w-xl mx-auto">
              Use this checklist for every bid. Items marked with a red flag are compliance-critical — skip them and your proposal may be rejected.
            </motion.p>

            <div className="space-y-8">
              {checklist.map(phase => (
                <motion.div key={phase.phase} variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className={`px-6 py-4 bg-${phase.color}-50 border-b border-slate-200 flex items-center gap-3`}>
                    <phase.icon className={`w-5 h-5 text-${phase.color}-600`} />
                    <h3 className="font-bold text-slate-900">{phase.phase}</h3>
                    <span className="text-xs text-slate-500 ml-auto">{phase.items.length} items</span>
                  </div>
                  <div className="p-6">
                    <ul className="space-y-3">
                      {phase.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 ${item.critical ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} />
                          <span className="text-sm text-slate-700">
                            {item.task}
                            {item.critical && <span className="ml-2 text-xs text-red-500 font-semibold">CRITICAL</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Key Terms Glossary */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-2 text-center">
              Government Contracting Glossary
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 text-center mb-10 max-w-xl mx-auto">
              Key terms every contractor needs to know.
            </motion.p>

            <div className="grid sm:grid-cols-2 gap-4">
              {keyTerms.map(t => (
                <motion.div key={t.term} variants={fadeUp} className="bg-white rounded-xl border border-slate-200 p-5">
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{t.term}</h4>
                  <p className="text-sm text-slate-600">{t.definition}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-b from-white to-emerald-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-4">
              <Zap className="w-3.5 h-3.5" />
              Win More Contracts
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              Procuvex Handles the Hard Parts
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-600 max-w-xl mx-auto mb-8">
              From finding opportunities on SAM.gov to building compliance matrices to managing subcontractor quotes — 
              Procuvex automates the tedious work so you can focus on winning.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-xl transition-all"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/guides/compliance-matrix"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
              >
                <Shield className="w-4 h-4" />
                Compliance Matrix Guide
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
