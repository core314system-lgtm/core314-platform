import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Upload, Brain, Shield, FileText, Users,
  Crosshair, Mail, ShieldCheck, Award,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }

const steps = [
  {
    num: '1',
    icon: Upload,
    title: 'Create a Project',
    desc: 'Select your project type (Government Task Order, RFP, Construction Bid, IT Services, or Commercial) and enter basic details — title, solicitation number, due date, location.',
    detail: 'Each project type comes with tailored workflow stages, labels, and analytics. You can also import projects directly from SAM.gov or CSV files.',
  },
  {
    num: '2',
    icon: FileText,
    title: 'Upload Your Documents',
    desc: 'Upload the complete bid package — SOW, pricing sheets, exhibits, amendments, wage determinations, Q&A responses, subcontractor quotes, and any supporting documents.',
    detail: 'Procuvex supports PDF, DOCX, XLSX, and text files. Drag-and-drop multiple files at once. Each document is categorized for structured analysis.',
  },
  {
    num: '3',
    icon: Brain,
    title: 'Run AI Analysis',
    desc: 'One click triggers comprehensive AI analysis across all your documents. In seconds, Procuvex extracts requirements, service categories, unclear items, pricing risks, and key metadata.',
    detail: 'The AI identifies contract details (contract number, vehicle, period of performance), key personnel requirements, compliance obligations, and areas that need clarification.',
  },
  {
    num: '4',
    icon: Shield,
    title: 'Generate Compliance & Outputs',
    desc: 'Generate a compliance matrix, RFQ packages, pricing risk report, clarification questions, and an executive summary — all derived from the AI analysis.',
    detail: 'Each output is immediately usable: export compliance matrices to Excel, send RFQ packages to subcontractors via email, and share executive summaries with leadership. For government RFPs, AI also extracts Section L/M evaluation criteria to align your proposal structure.',
  },
  {
    num: '4b',
    icon: ShieldCheck,
    title: 'Capture Gate Review (GovCon)',
    desc: 'Before proceeding to the next phase, run a Shipley-aligned gate review. Check off criteria, assign reviewers, and make a GO/NO-GO/CONDITIONAL GO decision with documented rationale.',
    detail: 'Gates are customizable at both the organization level (Settings → Gate Templates) and per-project. Default Shipley gates: Qualify, Capture Strategy, Win Strategy, Proposal Ready, and Submit. AI Past Performance Matching also recommends the most relevant citations from your library for the proposal.',
  },
  {
    num: '5',
    icon: Crosshair,
    title: 'Match Subs by Location & Trade',
    desc: 'AI maps each SOW line item to a trade category and finds qualified subcontractors within your chosen radius — 10 miles to nationwide.',
    detail: 'Combine Local (configurable radius), Regional (adjacent states), and National scopes. Per-trade queries ensure every SOW item gets coverage. Results show distance from project site.',
  },
  {
    num: '6',
    icon: Mail,
    title: 'Compose & Send RFQs',
    desc: 'Customize your RFQ with your company branding, merge fields, and a custom note. Preview exactly what each subcontractor will receive before sending.',
    detail: 'The RFQ Composer auto-populates project details (title, location, due date, SOW categories) and your company name. Select a saved template or write custom copy.',
  },
  {
    num: '7',
    icon: Users,
    title: 'Collaborate & Track',
    desc: 'Assign team members and subcontractors to the project. Track workflow stages from intake through submission. Run Color Team Reviews (Pink, Red, Gold) with structured findings and action items.',
    detail: 'The workflow engine supports stage changes with audit trails, approval notes, and team notifications. Every action is logged for accountability. Color Team Reviews provide formal quality checkpoints before submission, with reviewer assignments and scored findings.',
  },
  {
    num: '8',
    icon: Award,
    title: 'Win & Learn',
    desc: 'After the outcome, complete a structured debrief. Upload CPARS reports and past performance documents — AI extracts citations into your Past Performance Library for future proposals.',
    detail: 'Over time, your organization builds a knowledge base that makes every future bid stronger. The Past Performance Library stores citations with CPARS ratings, narratives, and relevance tags. AI automatically matches the best citations to future projects based on NAICS, agency, scope, and contract value.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-3">How It Works</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              From Upload to <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Award</span> in Ten Steps
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-lg text-slate-600 leading-relaxed">
              Procuvex streamlines the entire bid lifecycle. Here is exactly how your team will use it.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200 hidden md:block" />

            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative flex gap-6 mb-12 last:mb-0"
              >
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
                    <span className="text-xl font-extrabold text-white">{step.num}</span>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <step.icon className="h-5 w-5 text-blue-600" />
                    <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Poppins, sans-serif' }}>{step.title}</h3>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-3">{step.desc}</p>
                  <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4">{step.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>See the Difference</h2>
          <p className="text-lg text-blue-100 mb-8">Try Procuvex on your next bid and experience the full workflow firsthand.</p>
          <Link to="/login" className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all">
            Start Free Trial <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
