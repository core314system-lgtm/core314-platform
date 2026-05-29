import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, Shield, FileText, AlertTriangle,
  Layers, Target, BookOpen, ListChecks, Zap,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.08 } } }

const steps = [
  {
    step: 1,
    title: 'Read the Entire Solicitation',
    desc: 'Before building your matrix, read every section of the RFP/RFQ — including amendments, attachments, and referenced documents. Miss a single clause and your proposal could be marked non-responsive.',
    tips: [
      'Pay special attention to Section L (Instructions) and Section M (Evaluation Criteria)',
      'Download and review all attachments, not just the main SOW',
      'Note any FAR/DFARS clauses referenced by number — each may have specific compliance requirements',
      'Check for any amendments that may modify original requirements',
    ],
    icon: BookOpen,
  },
  {
    step: 2,
    title: 'Extract Every Requirement',
    desc: 'Go through the document line by line and pull out every "shall," "must," "will," and "required" statement. These are your compliance obligations. Miss one and you risk a non-compliant bid.',
    tips: [
      'Search for keywords: shall, must, will, required, mandatory, expected',
      'Don\'t forget performance standards, reporting requirements, and deliverable schedules',
      'Include both technical and administrative requirements',
      'Note which section each requirement comes from for traceability',
    ],
    icon: ListChecks,
  },
  {
    step: 3,
    title: 'Categorize Requirements',
    desc: 'Group your extracted requirements into logical categories. This makes it easier to assign responsibility and track completion across your team.',
    tips: [
      'Common categories: Technical, Management, Staffing, Past Performance, Pricing, Security',
      'Add sub-categories for complex RFPs (e.g., Technical → Software Development, Technical → Testing)',
      'Flag "go/no-go" requirements — things that are absolute disqualifiers if not met',
      'Separate mandatory (M) requirements from desirable (D) ones',
    ],
    icon: Layers,
  },
  {
    step: 4,
    title: 'Map Requirements to Your Response',
    desc: 'For each requirement, document exactly where and how your proposal addresses it. Include the specific proposal section, page number, and a brief description of your approach.',
    tips: [
      'Use a cross-reference system: RFP Section → Requirement → Proposal Section → Page',
      'Include volume and section numbers for multi-volume proposals',
      'Add a "compliance status" column: Compliant, Partial, Exception, Non-Compliant',
      'Document any exceptions or deviations with justification',
    ],
    icon: Target,
  },
  {
    step: 5,
    title: 'Verify and Validate',
    desc: 'Have someone who did NOT build the matrix review it against the original solicitation. Fresh eyes catch gaps that the original author misses. This is your last line of defense.',
    tips: [
      'Conduct a "red team" review where someone tries to find gaps',
      'Check every page reference actually matches the correct content',
      'Verify all FAR/DFARS clauses are addressed, especially flow-down requirements',
      'Confirm nothing was added in amendments that isn\'t in the matrix',
    ],
    icon: Shield,
  },
]

const commonMistakes = [
  {
    mistake: 'Only tracking Section C (SOW) requirements',
    fix: 'Requirements exist throughout the RFP — Sections B, F, G, H, I, J, K, L, and M all contain compliance obligations',
  },
  {
    mistake: 'Building the matrix after writing the proposal',
    fix: 'Build the matrix FIRST. It should guide your proposal outline, not be an afterthought',
  },
  {
    mistake: 'Using a flat list instead of a structured matrix',
    fix: 'A proper matrix cross-references RFP requirements to proposal sections with status tracking',
  },
  {
    mistake: 'Not tracking FAR/DFARS clause compliance',
    fix: 'Every incorporated FAR/DFARS clause has specific compliance actions. Map each one to your response',
  },
  {
    mistake: 'Ignoring evaluation criteria weighting',
    fix: 'Align your matrix categories to Section M evaluation factors — this ensures your proposal addresses what evaluators care about most',
  },
  {
    mistake: 'No version control on the matrix',
    fix: 'Amendments change requirements. Track which version of the RFP each requirement came from',
  },
]

export default function ComplianceMatrixGuidePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              Resource Guide
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
              How to Build a Compliance Matrix for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Government RFPs
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              A compliance matrix is the single most important document in your proposal. It proves you read the RFP, understood every requirement, and addressed each one. Here's how to build one that wins.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-xl transition-all"
              >
                Automate This with Procuvex
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-4">
              Why Compliance Matrices Win Contracts
            </motion.h2>
            <motion.div variants={fadeUp} className="prose prose-slate max-w-none">
              <p className="text-slate-600 leading-relaxed mb-4">
                Government evaluators review dozens — sometimes hundreds — of proposals for each solicitation. 
                They use evaluation checklists derived directly from the RFP requirements. A compliance matrix 
                is your proof that every checkbox gets checked.
              </p>
              <p className="text-slate-600 leading-relaxed mb-4">
                According to the Government Accountability Office (GAO), <strong>one of the top reasons proposals 
                are rejected is failure to address all stated requirements</strong>. A proper compliance matrix 
                makes it physically impossible to miss a requirement — and makes it easy for evaluators to see 
                that you've addressed everything.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mt-8">
                {[
                  { stat: '#1', label: 'Reason proposals lose: missed requirements', icon: AlertTriangle },
                  { stat: '40+', label: 'Hours saved per proposal with a structured matrix', icon: Zap },
                  { stat: '2-3x', label: 'Higher win rate with compliance-verified proposals', icon: Target },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-5 text-center">
                    <item.icon className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-slate-900">{item.stat}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Step-by-Step Guide */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-2 text-center">
              5 Steps to Build a Winning Compliance Matrix
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 text-center mb-12 max-w-xl mx-auto">
              Follow this process for every proposal. It works for task orders, RFPs, RFQs, and IDIQs.
            </motion.p>

            <div className="space-y-8">
              {steps.map((s) => (
                <motion.div key={s.step} variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      {s.step}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{s.title}</h3>
                      <p className="text-slate-600 mb-4">{s.desc}</p>
                      <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pro Tips</h4>
                        <ul className="space-y-2">
                          {s.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Common Mistakes */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-2xl font-bold text-slate-900 mb-2 text-center">
              6 Compliance Matrix Mistakes That Cost Contracts
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 text-center mb-10 max-w-xl mx-auto">
              Avoid these common errors that lead to non-responsive proposals.
            </motion.p>

            <div className="grid sm:grid-cols-2 gap-4">
              {commonMistakes.map((m, i) => (
                <motion.div key={i} variants={fadeUp} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{m.mistake}</h4>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 ml-8">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-600">{m.fix}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Procuvex CTA */}
      <section className="py-16 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
              <Zap className="w-3.5 h-3.5" />
              Skip the Manual Work
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              Procuvex Builds Your Compliance Matrix Automatically
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-600 max-w-xl mx-auto mb-8">
              Upload your RFP/RFQ and Procuvex's AI extracts every requirement, maps it to FAR/DFARS clauses, 
              categorizes by evaluation factor, and generates a complete compliance matrix in minutes — not days.
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
                to="/product"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
              >
                <FileText className="w-4 h-4" />
                See How It Works
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
